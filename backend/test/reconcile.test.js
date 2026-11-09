import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { id } from "ethers";
import { stubModule, stubReader } from "./support/stubModule.js";
import { computeRecordHash } from "../src/hashing/canonical.js";

const reader = stubReader();
const drafts = stubModule("repositories/pendingSave.repository.js", [
  "listPending",
  "resolve",
  "findByTxHash",
]);
const events = stubModule("repositories/batchEvent.repository.js", [
  "existsByTxHash",
]);
const batchWrites = stubModule("services/batch.service.js", [
  "writeFarmBatch",
  "writeListing",
  "writeMillIntake",
]);
const transporterWrites = stubModule("services/transporter.service.js", [
  "writeClaim",
  "writeHandover",
]);
stubModule("services/receipt.service.js", ["writeReceipt"]);

const { reconcilePendingSaves } =
  await import("../src/services/reconcile.service.js");

const FARMER = "0xAAAA000000000000000000000000000000000001";
const MILL = "0xBBBB000000000000000000000000000000000002";
const OTHER = "0xCCCC000000000000000000000000000000000003";
const TX = `0x${"1".repeat(64)}`;
const NOW = Date.UTC(2026, 10, 9, 12);
const HOUR = 60 * 60 * 1000;
const MAX_AGE = 24 * HOUR;

const record = {
  harvest_date: "2026-10-01",
  location: "Jenin",
  olive_type: "Nabali",
};
const dataHash = computeRecordHash("farm", record);

const draft = (overrides = {}) => ({
  id: 1,
  walletAddress: FARMER.toLowerCase(),
  batchId: "B9",
  detailsType: "farm",
  payload: record,
  dataHash,
  createdAt: new Date(NOW - HOUR),
  ...overrides,
});
const created = (farmer = FARMER) => ({
  name: "BatchCreated",
  txHash: TX,
  blockNumber: 5,
  args: {
    batchId: id("B9"),
    farmer,
    destinationAddress: MILL,
    harvestDataHash: dataHash,
  },
});

let calls;
let pending;
let history;
beforeEach(() => {
  calls = [];
  pending = [draft()];
  history = [created()];
  reader.getBatchHistory = async (batchId) => {
    calls.push(["history", batchId]);
    return history;
  };
  reader.decodeCustodyTx = async () => ({
    success: true,
    events: history.map((event) => ({
      ...event,
      topics: ["0x", id("B9")],
    })),
  });
  drafts.listPending = async () => pending;
  drafts.resolve = async (...args) => {
    calls.push(["resolve", ...args]);
    return [{ id: args[0] }];
  };
  drafts.findByTxHash = async () => [];
  events.existsByTxHash = async () => false;
  batchWrites.writeFarmBatch = async (args) => {
    calls.push(["writeFarmBatch", args]);
  };
  transporterWrites.writeClaim = async (args) => {
    calls.push(["writeClaim", args]);
  };
});

const run = () => reconcilePendingSaves({ maxAgeMs: MAX_AGE, now: NOW });
const resolves = () => calls.filter(([name]) => name === "resolve");

test("a mined draft is saved through the record's write", async () => {
  assert.deepEqual(await run(), { confirmed: 1, failed: 0, pending: 0 });

  const [, args] = calls.find(([name]) => name === "writeFarmBatch");
  assert.equal(args.wallet, FARMER.toLowerCase());
  assert.equal(args.batchId, "B9");
  assert.equal(args.txHash, TX);
  assert.deepEqual(args.record, record);
  assert.equal(args.dataHash, dataHash);
  assert.equal(args.decoded.success, true);
});

test("a draft with no mined transaction stays pending", async () => {
  history = [];
  assert.deepEqual(await run(), { confirmed: 0, failed: 0, pending: 1 });
  assert.deepEqual(resolves(), []);
});

test("a draft with no mined transaction fails after the maximum age", async () => {
  history = [];
  pending = [draft({ createdAt: new Date(NOW - 25 * HOUR) })];

  assert.deepEqual(await run(), { confirmed: 0, failed: 1, pending: 0 });
  assert.deepEqual(resolves(), [
    [
      "resolve",
      1,
      { status: "failed", failureReason: "no matching transaction was mined" },
    ],
  ]);
});

test("an event sent by another wallet does not match the draft", async () => {
  history = [created(OTHER)];
  assert.deepEqual(await run(), { confirmed: 0, failed: 0, pending: 1 });
  assert.ok(!calls.some(([name]) => name === "writeFarmBatch"));
});

test("a transaction already saved by the save route confirms the draft", async () => {
  events.existsByTxHash = async () => true;

  assert.deepEqual(await run(), { confirmed: 1, failed: 0, pending: 0 });
  assert.deepEqual(resolves(), [
    ["resolve", 1, { status: "confirmed", txHash: TX }],
  ]);
  assert.ok(!calls.some(([name]) => name === "writeFarmBatch"));
});

test("a duplicate draft of an already confirmed one fails", async () => {
  events.existsByTxHash = async () => true;
  drafts.findByTxHash = async () => [{ id: 2 }];

  assert.deepEqual(await run(), { confirmed: 0, failed: 1, pending: 0 });
  assert.deepEqual(resolves(), [
    [
      "resolve",
      1,
      {
        status: "failed",
        failureReason: "details already saved from another draft",
      },
    ],
  ]);
});

test("a write that fails is retried, then fails the draft after the maximum age", async () => {
  batchWrites.writeFarmBatch = async () => {
    throw new Error(
      "on-chain destination is missing from the participant directory",
    );
  };

  assert.deepEqual(await run(), { confirmed: 0, failed: 0, pending: 1 });

  pending = [draft({ createdAt: new Date(NOW - 25 * HOUR) })];
  assert.deepEqual(await run(), { confirmed: 0, failed: 1, pending: 0 });
  assert.equal(
    resolves()[0][2].failureReason,
    "on-chain destination is missing from the participant directory",
  );
});

test("each batch's history is read once per run", async () => {
  pending = [draft({ id: 1 }), draft({ id: 2, batchId: "B9" })];
  events.existsByTxHash = async () => true;
  drafts.findByTxHash = async () => [];

  await run();
  assert.equal(calls.filter(([name]) => name === "history").length, 1);
});

test("an oil pickup draft is saved through the claim write", async () => {
  const pickup = { quantity_picked_up: 50 };
  const pickupHash = computeRecordHash("transporter_oil", pickup);
  pending = [
    draft({
      walletAddress: OTHER.toLowerCase(),
      detailsType: "transporter_oil_pickup",
      payload: pickup,
      dataHash: pickupHash,
    }),
  ];
  history = [
    {
      name: "BatchClaimed",
      txHash: TX,
      blockNumber: 6,
      args: {
        batchId: id("B9"),
        transporter: OTHER,
        intakeDataHash: pickupHash,
      },
    },
  ];

  assert.deepEqual(await run(), { confirmed: 1, failed: 0, pending: 0 });
  const [, args] = calls.find(([name]) => name === "writeClaim");
  assert.equal(args.productType, "oil");
  assert.equal(args.detailsType, "transporter_oil_pickup");
});
