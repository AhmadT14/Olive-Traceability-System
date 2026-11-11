import { config } from "../config.js";
import * as chainEventRepository from "../db/repositories/chainEvent.repository.js";
import { runInTransaction } from "../db/repositories/unitOfWork.js";
import { sameAddress } from "./addresses.js";
import { batchCustody, provider, registry } from "./contracts.js";
import { eventArgsToObject } from "./eventArgs.js";
import { blockRanges } from "./logPages.js";

const CURSOR = "events";

export function toEventRow(log, blockTime) {
  const contract = sameAddress(log.address, batchCustody.target)
    ? batchCustody
    : registry;
  const parsed = contract.interface.parseLog(log);
  if (!parsed) return null;

  const inputs = parsed.fragment.inputs;
  return {
    contractAddress: log.address.toLowerCase(),
    eventName: parsed.name,
    txHash: log.transactionHash.toLowerCase(),
    logIndex: log.index,
    blockNumber: log.blockNumber,
    blockTime,
    batchTopic: inputs[0]?.name === "batchId" ? log.topics[1] : null,
    addresses: inputs.flatMap((input, index) =>
      input.type === "address"
        ? [String(parsed.args[index]).toLowerCase()]
        : [],
    ),
    args: eventArgsToObject(parsed),
  };
}

async function readBlockTimes(logs) {
  const numbers = [...new Set(logs.map((log) => log.blockNumber))];
  const blocks = await Promise.all(numbers.map((n) => provider.getBlock(n)));
  return new Map(
    blocks.map((block, index) => [
      numbers[index],
      new Date(block.timestamp * 1000),
    ]),
  );
}

async function runSync() {
  const [lastBlock, head] = await Promise.all([
    chainEventRepository.getCursor(CURSOR),
    provider.getBlockNumber(),
  ]);
  if (lastBlock !== null && lastBlock > head) {
    throw new Error(
      `event index is at block ${lastBlock} but the chain is at ${head}; the chain was reset, so clear chain_events and chain_sync_state`,
    );
  }

  const fromBlock = lastBlock === null ? config.DEPLOY_BLOCK : lastBlock + 1;
  for (const [from, to] of blockRanges(
    fromBlock,
    head,
    config.LOG_BLOCK_RANGE,
  )) {
    const logs = await provider.getLogs({
      address: [batchCustody.target, registry.target],
      fromBlock: from,
      toBlock: to,
    });
    const blockTimes = await readBlockTimes(logs);
    const rows = logs
      .map((log) => toEventRow(log, blockTimes.get(log.blockNumber)))
      .filter(Boolean);

    await runInTransaction(async (exec) => {
      await chainEventRepository.insertMany(rows, exec);
      await chainEventRepository.setCursor(CURSOR, to, exec);
    });
  }
}

let current = null;
let next = null;

export function syncEvents() {
  if (!current) {
    current = runSync().finally(() => {
      current = null;
    });
    return current;
  }
  next ??= current
    .catch(() => {})
    .then(() => {
      next = null;
      return syncEvents();
    });
  return next;
}

export function startEventSync({ intervalMs }) {
  const run = () =>
    syncEvents().catch((err) => console.error("event sync failed:", err));
  run();
  return setInterval(run, intervalMs);
}
