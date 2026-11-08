import assert from "node:assert/strict";
import test from "node:test";
import { countByStage } from "../src/chain/stageCounts.js";
import {
  batchStageStatsResponseSchema,
  receivedBatchesResponseSchema,
} from "../src/validation/response.schemas.js";

test("the received-batches response schema accepts the service output", () => {
  const item = {
    batchId: "B1",
    txHash: `0x${"a".repeat(64)}`,
    receivedAt: "2026-11-02T10:00:00.000Z",
    quantityReceived: null,
  };
  for (const quantityReceived of [null, "99.5", 99.5]) {
    assert.ok(
      receivedBatchesResponseSchema.safeParse({
        batches: [{ ...item, quantityReceived }],
      }).success,
    );
  }
  assert.ok(receivedBatchesResponseSchema.safeParse({ batches: [] }).success);
  const { receivedAt: _drop, ...incomplete } = item;
  assert.equal(
    receivedBatchesResponseSchema.safeParse({ batches: [incomplete] }).success,
    false,
  );
});

test("the batch-stage statistics schema accepts the chain counts", () => {
  const stages = countByStage(["Farm", "Mill", "Farm"]);
  assert.ok(batchStageStatsResponseSchema.safeParse({ stages }).success);
  assert.ok(
    batchStageStatsResponseSchema.safeParse({ stages: countByStage([]) })
      .success,
  );
  assert.equal(
    batchStageStatsResponseSchema.safeParse({ stages: [{ stage: "Farm" }] })
      .success,
    false,
  );
});
