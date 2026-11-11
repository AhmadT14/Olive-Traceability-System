import test from "node:test";
import assert from "node:assert/strict";
import { id } from "ethers";
import { replayBatchJobs, replayJobs } from "../src/chain/rebuild.js";

const FARM = "0xAAAA000000000000000000000000000000000001";
const MILL = "0xBBBB000000000000000000000000000000000002";
const STORAGE = "0xCCCC000000000000000000000000000000000003";
const TRANSPORTER = "0xDDDD000000000000000000000000000000000004";
const OTHER = "0xEEEE000000000000000000000000000000000005";

let block = 0;
const event = (
  batchId,
  eventName,
  args,
  txHash = `0x${String(block).padStart(64, "0")}`,
) => {
  block += 1;
  return {
    eventName,
    txHash,
    blockNumber: block,
    blockTime: new Date(Date.UTC(2026, 10, 1, 0, block)),
    batchTopic: batchId ? id(batchId) : null,
    args,
  };
};

const journey = () => {
  block = 0;
  return [
    event(
      "B1",
      "BatchCreated",
      { farmer: FARM, destinationAddress: MILL },
      "0x01",
    ),
    event("B1", "BatchReserved", { transporter: TRANSPORTER }, "0x02"),
    event(
      "B1",
      "ReservationReleased",
      { transporter: TRANSPORTER, releasedBy: FARM },
      "0x03",
    ),
    event("B1", "BatchReserved", { transporter: TRANSPORTER }, "0x04"),
    event("B1", "BatchClaimed", { transporter: TRANSPORTER }, "0x05"),
    event(
      "B1",
      "HandoverInitiated",
      { currentCustodian: TRANSPORTER, targetAddress: MILL },
      "0x06",
    ),
    event("B1", "ReceiptConfirmed", { newCustodian: MILL }, "0x07"),
    event(
      "B1",
      "BatchListed",
      { custodian: MILL, destinationAddress: STORAGE },
      "0x08",
    ),
    event("B1", "BatchReserved", { transporter: OTHER }, "0x09"),
  ];
};

test("a batch's events replay into one job per listing, in order", () => {
  const events = journey();
  const jobs = replayBatchJobs(events, (txHash) => txHash !== "0x05");

  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs[0], {
    sourceParty: FARM.toLowerCase(),
    destinationParty: MILL.toLowerCase(),
    transporter: TRANSPORTER.toLowerCase(),
    status: "completed",
    listingTxHash: "0x01",
    claimTxHash: null,
    handoverTxHash: "0x06",
    receiptTxHash: "0x07",
    reserveTxHash: "0x04",
    reservedAt: events[3].blockTime,
    createdAt: events[0].blockTime,
  });
  assert.deepEqual(jobs[1], {
    sourceParty: MILL.toLowerCase(),
    destinationParty: STORAGE.toLowerCase(),
    transporter: OTHER.toLowerCase(),
    status: "reserved",
    listingTxHash: "0x08",
    claimTxHash: null,
    handoverTxHash: null,
    receiptTxHash: null,
    reserveTxHash: "0x09",
    reservedAt: events[8].blockTime,
    createdAt: events[7].blockTime,
  });
});

test("a release clears the reservation and a claim can follow a reservation", () => {
  const events = journey().slice(0, 3);
  const [job] = replayBatchJobs(events, () => true);
  assert.equal(job.status, "available");
  assert.equal(job.transporter, null);
  assert.equal(job.reserveTxHash, null);
  assert.equal(job.reservedAt, null);

  const [claimed] = replayBatchJobs(journey().slice(0, 5), () => true);
  assert.equal(claimed.status, "claimed");
  assert.equal(claimed.reserveTxHash, "0x04");
});

test("events before any listing are ignored", () => {
  assert.deepEqual(
    replayBatchJobs(
      [event("B1", "BatchClaimed", { transporter: TRANSPORTER })],
      () => true,
    ),
    [],
  );
});

test("replayJobs groups by batch, names the batch and collects the wallets", () => {
  const events = [
    ...journey(),
    event("B2", "BatchCreated", { farmer: FARM, destinationAddress: MILL }),
    event(null, "RegistryChanged", {}),
    event("B3", "BatchListed", {
      custodian: OTHER,
      destinationAddress: STORAGE,
    }),
  ];
  const batchIds = new Map([
    [id("B1").toLowerCase(), "B1"],
    [id("B2").toLowerCase(), "B2"],
  ]);

  const { jobs, wallets, unknownTopics } = replayJobs(events, {
    batchIds,
    hasRecord: () => false,
  });

  assert.deepEqual(
    jobs.map((job) => [job.batchId, job.status, job.listingTxHash]),
    [
      ["B1", "completed", null],
      ["B1", "reserved", null],
      ["B2", "available", null],
    ],
  );
  assert.deepEqual(
    wallets,
    [FARM, MILL, TRANSPORTER, STORAGE, OTHER].map((w) => w.toLowerCase()),
  );
  assert.deepEqual(unknownTopics, [id("B3").toLowerCase()]);
});

test("nothing to replay gives empty results", () => {
  assert.deepEqual(
    replayJobs([], { batchIds: new Map(), hasRecord: () => true }),
    {
      jobs: [],
      wallets: [],
      unknownTopics: [],
    },
  );
});
