import test from "node:test";
import assert from "node:assert/strict";
import { matchCreatedBatches } from "../src/chain/createdBatches.js";
import { createdBatchesResponseSchema } from "../src/validation/response.schemas.js";

const tx = (n) => `0x${String(n).repeat(64)}`;
const event = (n, blockNumber, timestamp = 1_700_000_000) => ({
  txHash: tx(n),
  blockNumber,
  timestamp,
});
const row = (n, batchId, details = { harvest_date: "2026-10-01" }) => ({
  eventTxHash: tx(n),
  batchId,
  details,
});

test("each event is matched to its saved farm record by transaction hash", () => {
  const result = matchCreatedBatches(
    [event(1, 10, 1_700_000_000)],
    [row(1, "NABLUS-1")],
  );
  assert.deepEqual(result, [
    {
      batchId: "NABLUS-1",
      createdBlock: 10,
      createdAt: "2023-11-14T22:13:20.000Z",
      harvestDate: "2026-10-01",
    },
  ]);
});

test("matching ignores the case of the stored transaction hash", () => {
  const upper = {
    ...row(1, "B1"),
    eventTxHash: tx("a").toUpperCase().replace("0X", "0x"),
  };
  const lower = { txHash: tx("a"), blockNumber: 3, timestamp: 1 };
  assert.equal(matchCreatedBatches([lower], [upper]).length, 1);
});

test("a created batch with no saved record is left out", () => {
  const result = matchCreatedBatches(
    [event(1, 10), event(2, 11)],
    [row(2, "SAVED")],
  );
  assert.deepEqual(
    result.map((b) => b.batchId),
    ["SAVED"],
  );
});

test("newest first, with the batch id as the tiebreak within a block", () => {
  const result = matchCreatedBatches(
    [event(1, 5), event(2, 9), event(3, 9), event(4, 7)],
    [row(1, "A"), row(2, "Z"), row(3, "M"), row(4, "B")],
  );
  assert.deepEqual(
    result.map((b) => b.batchId),
    ["M", "Z", "B", "A"],
  );
});

test("a missing or non-text harvest date becomes null", () => {
  const result = matchCreatedBatches(
    [event(1, 1), event(2, 2), event(3, 3), event(4, 4)],
    [
      row(1, "A", {}),
      row(2, "B", { harvest_date: "" }),
      row(3, "C", { harvest_date: 20261001 }),
      row(4, "D", null),
    ],
  );
  assert.ok(result.every((b) => b.harvestDate === null));
});

test("nothing created gives an empty list", () => {
  assert.deepEqual(matchCreatedBatches([], []), []);
  assert.deepEqual(matchCreatedBatches([event(1, 1)], []), []);
});

test("the created-batches response schema accepts the service output", () => {
  const wallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const item = {
    batchId: "B1",
    status: "Listed",
    stage: "Farm",
    custodian: wallet,
    pendingTarget: "0x0000000000000000000000000000000000000000",
    destination: wallet,
    harvestDate: null,
    createdBlock: 12,
    createdAt: "2026-10-31T10:00:00.000Z",
  };
  assert.ok(
    createdBatchesResponseSchema.safeParse({ batches: [item] }).success,
  );
  assert.ok(createdBatchesResponseSchema.safeParse({ batches: [] }).success);
  const { createdBlock: _drop, ...incomplete } = item;
  assert.equal(
    createdBatchesResponseSchema.safeParse({ batches: [incomplete] }).success,
    false,
  );
});
