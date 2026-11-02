import test from "node:test";
import assert from "node:assert/strict";
import { id } from "ethers";
import { matchBatchIdsByTopic } from "../src/chain/batchTopics.js";
import { countByStage } from "../src/chain/stageCounts.js";

const receipt = (batchId, blockNumber, txByte) => ({
  txHash: `0x${txByte.repeat(64)}`,
  blockNumber,
  timestamp: 1_700_000_000 + blockNumber,
  batchTopic: id(batchId),
});

test("matchBatchIdsByTopic finds the readable id and sorts newest first", () => {
  const events = [receipt("B1", 10, "a"), receipt("B2", 30, "b")];

  assert.deepEqual(matchBatchIdsByTopic(events, ["B1", "B2", "B3"]), [
    {
      batchId: "B2",
      txHash: `0x${"b".repeat(64)}`,
      receivedBlock: 30,
      receivedAt: new Date((1_700_000_000 + 30) * 1000).toISOString(),
    },
    {
      batchId: "B1",
      txHash: `0x${"a".repeat(64)}`,
      receivedBlock: 10,
      receivedAt: new Date((1_700_000_000 + 10) * 1000).toISOString(),
    },
  ]);
});

test("matchBatchIdsByTopic leaves out batches it has no id for", () => {
  const events = [receipt("B1", 10, "a"), receipt("UNKNOWN", 20, "c")];

  const matched = matchBatchIdsByTopic(events, ["B1"]);
  assert.deepEqual(
    matched.map((item) => item.batchId),
    ["B1"],
  );
});

test("matchBatchIdsByTopic ignores the case of the topic hash", () => {
  const event = {
    ...receipt("B1", 10, "a"),
    batchTopic: id("B1").toUpperCase().replace("0X", "0x"),
  };

  assert.equal(matchBatchIdsByTopic([event], ["B1"])[0].batchId, "B1");
});

test("countByStage lists every stage in chain order, zeros included", () => {
  assert.deepEqual(countByStage(["Mill", "Farm", "Mill", "Retailer"]), [
    { stage: "Farm", count: 1 },
    { stage: "Mill", count: 2 },
    { stage: "Storage", count: 0 },
    { stage: "Exporter", count: 0 },
    { stage: "Importer", count: 0 },
    { stage: "Retailer", count: 1 },
  ]);
});

test("countByStage ignores values that are not stages", () => {
  const counts = countByStage(["Mill", undefined, "Nowhere"]);
  assert.equal(
    counts.reduce((sum, item) => sum + item.count, 0),
    1,
  );
});
