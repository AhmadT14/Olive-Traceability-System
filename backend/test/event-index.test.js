import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getAddress, Interface, id, ZeroHash } from "ethers";
import { stubModule } from "./support/stubModule.js";

const abi = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../src/chain/abis/${name}.json`, import.meta.url),
      "utf8",
    ),
  );

const CUSTODY = "0x00000000000000000000000000000000000000C0";
const REGISTRY = "0x00000000000000000000000000000000000000E0";
const FARMER = "0xAAAA000000000000000000000000000000000001";
const MILL = "0xBBBB000000000000000000000000000000000002";
const HASH = `0x${"ab".repeat(32)}`;

const custodyInterface = new Interface(abi("BatchCustody"));
const registryInterface = new Interface(abi("ParticipantRegistry"));
const provider = {};

stubModule("config.js", [], {
  config: { DEPLOY_BLOCK: 3, LOG_BLOCK_RANGE: 10 },
});
stubModule("chain/contracts.js", [], {
  batchCustody: { target: CUSTODY, interface: custodyInterface },
  registry: { target: REGISTRY, interface: registryInterface },
  provider,
});
const repo = stubModule("repositories/chainEvent.repository.js", [
  "insertMany",
  "getCursor",
  "setCursor",
]);
const unitOfWork = stubModule("repositories/unitOfWork.js", [
  "runInTransaction",
]);

const { syncEvents, toEventRow } = await import("../src/chain/eventIndex.js");

const log = (contract, address, name, args, blockNumber = 4, index = 0) => {
  const { data, topics } = contract.encodeEventLog(name, args);
  return {
    address,
    data,
    topics,
    blockNumber,
    index,
    transactionHash: `0x${"F".repeat(64)}`,
  };
};
const createdLog = (blockNumber, index) =>
  log(
    custodyInterface,
    CUSTODY,
    "BatchCreated",
    ["B1", FARMER, MILL, HASH],
    blockNumber,
    index,
  );

let calls;
let cursor;
let head;
let logsByRange;
beforeEach(() => {
  calls = [];
  cursor = null;
  head = 25;
  logsByRange = () => [];
  repo.getCursor = async () => cursor;
  repo.insertMany = async (rows, exec) => {
    calls.push(["insert", rows.length, exec]);
  };
  repo.setCursor = async (name, block, exec) => {
    calls.push(["cursor", name, block, exec]);
  };
  unitOfWork.runInTransaction = (work) => work("exec");
  provider.getBlockNumber = async () => {
    calls.push(["head"]);
    return head;
  };
  provider.getLogs = async (filter) => {
    calls.push(["logs", filter.fromBlock, filter.toBlock]);
    assert.deepEqual(filter.address, [CUSTODY, REGISTRY]);
    return logsByRange(filter.fromBlock, filter.toBlock);
  };
  provider.getBlock = async (n) => ({ timestamp: 1_700_000_000 + n });
});

test("a batch event is indexed by its batch topic and lower-case addresses", () => {
  const time = new Date(0);
  const row = toEventRow(createdLog(4, 2), time);

  assert.deepEqual(row, {
    contractAddress: CUSTODY.toLowerCase(),
    eventName: "BatchCreated",
    txHash: `0x${"f".repeat(64)}`,
    logIndex: 2,
    blockNumber: 4,
    blockTime: time,
    batchTopic: id("B1"),
    addresses: [FARMER.toLowerCase(), MILL.toLowerCase()],
    args: {
      batchId: id("B1"),
      farmer: getAddress(FARMER.toLowerCase()),
      destinationAddress: getAddress(MILL.toLowerCase()),
      harvestDataHash: HASH,
    },
  });
});

test("a registry event has no batch topic", () => {
  const row = toEventRow(
    log(registryInterface, REGISTRY, "RoleGranted", [ZeroHash, FARMER, MILL]),
    null,
  );

  assert.equal(row.eventName, "RoleGranted");
  assert.equal(row.batchTopic, null);
  assert.deepEqual(row.addresses, [FARMER.toLowerCase(), MILL.toLowerCase()]);
});

test("the first sync reads from the deploy block in pages and saves each page with its cursor", async () => {
  logsByRange = (from) => (from === 3 ? [createdLog(4, 0)] : []);

  await syncEvents();

  assert.deepEqual(calls, [
    ["head"],
    ["logs", 3, 12],
    ["insert", 1, "exec"],
    ["cursor", "events", 12, "exec"],
    ["logs", 13, 22],
    ["insert", 0, "exec"],
    ["cursor", "events", 22, "exec"],
    ["logs", 23, 25],
    ["insert", 0, "exec"],
    ["cursor", "events", 25, "exec"],
  ]);
});

test("a later sync starts after the saved block and stops when up to date", async () => {
  cursor = 25;
  await syncEvents();
  assert.deepEqual(calls, [["head"]]);

  calls = [];
  head = 27;
  await syncEvents();
  assert.deepEqual(calls.slice(0, 2), [["head"], ["logs", 26, 27]]);
});

test("an index ahead of the chain stops the sync", async () => {
  cursor = 40;
  await assert.rejects(syncEvents(), /the chain was reset/);
});

test("a read during a sync waits for a fresh sync", async () => {
  cursor = 25;
  const first = syncEvents();
  const second = syncEvents();
  const third = syncEvents();

  assert.equal(second, third);
  await Promise.all([first, second]);
  assert.equal(calls.filter(([name]) => name === "head").length, 2);
});
