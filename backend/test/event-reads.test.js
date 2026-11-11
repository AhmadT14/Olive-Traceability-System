import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { id } from "ethers";
import { stubModule } from "./support/stubModule.js";

stubModule("chain/contracts.js", [], {
  batchCustody: {},
  registry: {},
  provider: {},
});
const index = stubModule("chain/eventIndex.js", ["syncEvents"]);
const repo = stubModule("db/repositories/chainEvent.repository.js", [
  "listByBatchTopic",
  "listByEventAndAddress",
]);

const { getBatchCreatedEvents, getBatchHistory } =
  await import("../src/chain/reader.js");

const FARMER = "0xAAAA000000000000000000000000000000000001";
const MILL = "0xBBBB000000000000000000000000000000000002";
const TX = `0x${"1".repeat(64)}`;

let calls;
beforeEach(() => {
  calls = [];
  index.syncEvents = async () => {
    calls.push(["sync"]);
  };
});

test("a batch's history comes from the index after a sync", async () => {
  const args = { batchId: id("B1"), farmer: FARMER };
  repo.listByBatchTopic = async (topic) => {
    calls.push(["list", topic]);
    return [
      {
        eventName: "BatchCreated",
        txHash: TX,
        blockNumber: 4,
        logIndex: 0,
        args,
      },
    ];
  };

  assert.deepEqual(await getBatchHistory("B1"), [
    { name: "BatchCreated", txHash: TX, blockNumber: 4, args },
  ]);
  assert.deepEqual(calls, [["sync"], ["list", id("B1")]]);
});

test("a farmer's created batches are the BatchCreated events they sent", async () => {
  repo.listByEventAndAddress = async (eventName, address) => {
    calls.push(["list", eventName, address]);
    return [
      {
        txHash: TX,
        blockNumber: 4,
        blockTime: new Date(1_700_000_000_500),
        args: { farmer: FARMER, destinationAddress: MILL },
      },
      {
        txHash: TX,
        blockNumber: 5,
        blockTime: new Date(1_700_000_100_000),
        args: { farmer: MILL, destinationAddress: FARMER },
      },
    ];
  };

  assert.deepEqual(await getBatchCreatedEvents(FARMER), [
    { txHash: TX, blockNumber: 4, timestamp: 1_700_000_000 },
  ]);
  assert.deepEqual(calls, [
    ["sync"],
    ["list", "BatchCreated", FARMER.toLowerCase()],
  ]);
});
