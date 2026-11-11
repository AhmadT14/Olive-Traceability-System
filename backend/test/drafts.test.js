import test, { beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { id } from "ethers";
import { stubModule, stubReader } from "./support/stubModule.js";
import { computeRecordHash } from "../src/hashing/canonical.js";

stubModule("config.js", [], {
  config: {
    BATCH_CUSTODY_ADDRESS: "0x00000000000000000000000000000000000000c0",
  },
});
stubModule("chain/contracts.js", [], {
  batchCustody: { interface: { encodeFunctionData: () => "0xdata" } },
});
const transaction = stubModule("services/transaction.js", [
  "prepareTransaction",
]);
const reader = stubReader();
const drafts = stubModule("db/repositories/pendingSave.repository.js", [
  "insert",
  "findPendingByBatchAndHash",
  "resolve",
]);
const participants = stubModule("db/repositories/participant.repository.js", [
  "findAvailability",
  "exists",
]);
const batches = stubModule("db/repositories/batch.repository.js", [
  "existsById",
  "insert",
]);
const events = stubModule("db/repositories/batchEvent.repository.js", [
  "existsByBatchAndType",
  "existsByTxHash",
  "insert",
]);
const jobs = stubModule("db/repositories/transporterJob.repository.js", [
  "findClaimableForTransporter",
  "findClaimedForTransporter",
  "findClaimedForHandover",
  "findPendingHandoverForDestination",
  "insert",
  "transition",
]);
const unitOfWork = stubModule("db/repositories/unitOfWork.js", [
  "runInTransaction",
]);

const { prepareBatch, prepareListing } =
  await import("../src/services/prepare.service.js");
const { recordFarmBatch } = await import("../src/services/batch.service.js");
const { handoverBatch } =
  await import("../src/services/transporter.service.js");

const FARMER = "0xAAAA000000000000000000000000000000000001";
const MILL = "0xBBBB000000000000000000000000000000000002";
const TRANSPORTER = "0xCCCC000000000000000000000000000000000003";
const OTHER = "0xdddd000000000000000000000000000000000004";
const TX = `0x${"1".repeat(64)}`;
const EXEC = "exec";

const farmRecord = {
  harvest_date: "2026-10-01",
  location: "Jenin",
  olive_type: "Nabali",
  quantity: 100,
};
const farmHash = computeRecordHash("farm", farmRecord);

let calls;
beforeEach(() => {
  calls = [];
  const log =
    (name, result) =>
    (...args) => {
      calls.push([name, ...args]);
      return Promise.resolve(result);
    };
  transaction.prepareTransaction = async () => ({ to: "0xc0", data: "0x" });
  reader.hasRole = async (role, address) =>
    ({ FARMER, MILL, TRANSPORTER })[role]?.toLowerCase() ===
    address.toLowerCase();
  reader.getBatch = async () => ({ status: "None", stage: "Farm" });
  drafts.insert = log("draft.insert", [{ id: 1 }]);
  drafts.findPendingByBatchAndHash = log("draft.find", []);
  drafts.resolve = log("draft.resolve", [{ id: 1 }]);
  participants.findAvailability = async () => ({ availability: "available" });
  participants.exists = async () => true;
  batches.existsById = async () => false;
  batches.insert = log("batch.insert");
  events.existsByBatchAndType = async () => true;
  events.existsByTxHash = async () => false;
  events.insert = log("event.insert");
  jobs.insert = log("job.insert");
  jobs.transition = log("job.transition", [{ id: 5 }]);
  jobs.findClaimedForHandover = log("job.findClaimedForHandover", [{ id: 5 }]);
  unitOfWork.runInTransaction = (work) => work(EXEC);
});

const names = () => calls.map(([name]) => name);

describe("prepare routes save a draft", () => {
  test("the farm prepare saves the hashed record for the caller", async () => {
    const result = await prepareBatch(
      { address: FARMER },
      { batchId: "B9", destinationAddress: MILL, ...farmRecord },
    );

    assert.equal(result.dataHash, farmHash);
    assert.deepEqual(calls, [
      [
        "draft.insert",
        {
          walletAddress: FARMER.toLowerCase(),
          batchId: "B9",
          detailsType: "farm",
          payload: farmRecord,
          dataHash: farmHash,
        },
      ],
    ]);
  });

  test("a listing prepare saves the draft under its save type", async () => {
    reader.getBatch = async () => ({
      status: "Created",
      stage: "Mill",
      custodian: MILL,
    });
    reader.hasRole = async (role, address) =>
      (role === "MILL" && address === MILL) ||
      (role === "STORAGE" && address === OTHER);

    await prepareListing(
      { address: MILL },
      { batchId: "B9", destinationAddress: OTHER, oil_quality: "extra" },
    );

    const [[, draft]] = calls;
    assert.equal(draft.detailsType, "mill_outgoing");
    assert.deepEqual(draft.payload, { oil_quality: "extra" });
    assert.equal(draft.dataHash, computeRecordHash("mill_oil", draft.payload));
  });

  test("no transaction is returned when the draft cannot be saved", async () => {
    drafts.insert = async () => {
      throw new Error("db down");
    };

    await assert.rejects(
      prepareBatch(
        { address: FARMER },
        { batchId: "B9", destinationAddress: MILL, ...farmRecord },
      ),
      { status: 500, message: "draft save failed" },
    );
  });

  test("no draft is saved when the transaction would fail", async () => {
    transaction.prepareTransaction = async () => {
      throw Object.assign(new Error("reverted"), { status: 409 });
    };

    await assert.rejects(
      prepareBatch(
        { address: FARMER },
        { batchId: "B9", destinationAddress: MILL, ...farmRecord },
      ),
    );
    assert.deepEqual(calls, []);
  });
});

describe("save routes confirm the draft", () => {
  const farmTx = () => ({
    success: true,
    events: [
      {
        name: "BatchCreated",
        topics: ["0x", id("B9")],
        args: {
          farmer: FARMER,
          destinationAddress: MILL,
          harvestDataHash: farmHash,
        },
      },
    ],
  });
  const saveFarm = () =>
    recordFarmBatch(
      { address: FARMER },
      { txHash: TX, batchId: "B9", ...farmRecord },
    );

  beforeEach(() => {
    reader.decodeCustodyTx = async () => farmTx();
  });

  test("the farm save confirms the caller's draft in the same transaction", async () => {
    drafts.findPendingByBatchAndHash = async (batchId, dataHash, exec) => {
      calls.push(["draft.find", batchId, dataHash, exec]);
      return [{ id: 7, walletAddress: FARMER.toLowerCase() }];
    };

    assert.deepEqual(await saveFarm(), { batchId: "B9", txHash: TX });
    assert.deepEqual(names(), [
      "batch.insert",
      "event.insert",
      "job.insert",
      "draft.find",
      "draft.resolve",
    ]);
    assert.deepEqual(calls.at(-2), ["draft.find", "B9", farmHash, EXEC]);
    assert.deepEqual(calls.at(-1), [
      "draft.resolve",
      7,
      { status: "confirmed", txHash: TX },
      EXEC,
    ]);
  });

  test("a draft from another wallet stays pending", async () => {
    drafts.findPendingByBatchAndHash = async () => [
      { id: 7, walletAddress: OTHER },
    ];

    await saveFarm();
    assert.ok(!names().includes("draft.resolve"));
  });

  test("a save without a draft still saves the record", async () => {
    await saveFarm();
    assert.deepEqual(names(), [
      "batch.insert",
      "event.insert",
      "job.insert",
      "draft.find",
    ]);
  });

  test("the farm save refuses a batch created by another wallet", async () => {
    reader.hasRole = async () => true;
    await assert.rejects(
      recordFarmBatch(
        { address: OTHER },
        { txHash: TX, batchId: "B9", ...farmRecord },
      ),
      { status: 403, message: "batch transaction was not submitted by caller" },
    );
    assert.deepEqual(calls, []);
  });
});

test("the handover save takes the target from the mined event", async () => {
  const record = { quantity_delivered: 90 };
  const dataHash = computeRecordHash("transporter_olive_outgoing", record);
  reader.getBatch = async () => ({
    status: "PendingHandover",
    stage: "Farm",
    custodian: TRANSPORTER,
    pendingTarget: MILL,
  });
  reader.decodeCustodyTx = async () => ({
    success: true,
    events: [
      {
        name: "HandoverInitiated",
        topics: ["0x", id("B9")],
        args: {
          currentCustodian: TRANSPORTER,
          targetAddress: MILL,
          outgoingDataHash: dataHash,
        },
      },
    ],
  });

  const result = await handoverBatch({ address: TRANSPORTER }, "B9", {
    txHash: TX,
    ...record,
  });

  assert.deepEqual(result, {
    batchId: "B9",
    txHash: TX,
    targetAddress: MILL,
    productType: "olive",
  });
  assert.deepEqual(calls[0], [
    "job.findClaimedForHandover",
    "B9",
    TRANSPORTER.toLowerCase(),
    MILL.toLowerCase(),
  ]);
  assert.deepEqual(names().slice(1), [
    "event.insert",
    "job.transition",
    "draft.find",
  ]);
});
