import { id, ZeroHash } from "ethers";
import { registry, batchCustody, provider } from "./contracts.js";
import { RoleNames, Status, Stage } from "./enums.js";
import { config } from "../config.js";
import { eventArgsToObject } from "./eventArgs.js";
import { readInPages } from "./logPages.js";
import { countByStage } from "./stageCounts.js";

export const ROLES = Object.fromEntries(
  RoleNames.map((name) => [name, id(`${name}_ROLE`)]),
);

export async function getBatch(batchId) {
  const [b, destination] = await Promise.all([
    batchCustody.batches(batchId),
    batchCustody.destinations(batchId),
  ]);
  return {
    status: Status[Number(b.status)],
    stage: Stage[Number(b.stage)],
    custodian: b.custodian,
    pendingTarget: b.pendingTarget,
    destination,
  };
}

export function hasRole(roleName, address) {
  return registry.hasRole(ROLES[roleName], address);
}

export function hasAdminRole(address) {
  return registry.hasRole(ZeroHash, address);
}

export async function decodeTx(txHash) {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return null;

  const events = receipt.logs
    .filter(
      (log) => log.address.toLowerCase() === batchCustody.target.toLowerCase(),
    )
    .map((log) => {
      const parsed = batchCustody.interface.parseLog(log);
      // topics is kept alongside the decoded args: batchId is `string
      // indexed` on every BatchCustody event, so Solidity only stores its
      // keccak256 in the topic — ethers can't reconstruct the original
      // string from args, only the raw topic hash is usable (see how
      // getBatchHistory below matches batchId, same reasoning).
      return (
        parsed && {
          name: parsed.name,
          fragment: parsed.fragment,
          args: parsed.args,
          topics: log.topics,
        }
      );
    })
    .filter(Boolean);

  return {
    success: receipt.status === 1,
    blockNumber: receipt.blockNumber,
    events,
  };
}

export async function decodeRegistryTx(txHash) {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return null;

  const events = receipt.logs
    .filter(
      (log) => log.address.toLowerCase() === registry.target.toLowerCase(),
    )
    .map((log) => {
      const parsed = registry.interface.parseLog(log);
      return parsed && { name: parsed.name, args: parsed.args };
    })
    .filter(Boolean);

  return {
    success: receipt.status === 1,
    blockNumber: receipt.blockNumber,
    events,
  };
}

// Every event for one batch, oldest first. batchId is the first indexed value
// on every BatchCustody event, so the node is asked for just the logs whose
// second topic is the batch id's hash instead of every event ever emitted.
export async function getBatchHistory(batchId) {
  const logs = await readLogs((fromBlock, toBlock) =>
    provider.getLogs({
      address: batchCustody.target,
      fromBlock,
      toBlock,
      topics: [null, id(batchId)],
    }),
  );

  return logs.flatMap((log) => {
    const parsed = batchCustody.interface.parseLog(log);
    if (!parsed) return [];
    return [
      {
        name: parsed.name,
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        args: eventArgsToObject(parsed),
      },
    ];
  });
}

// Every BatchCreated event for one farmer, with the time of its block. Only
// events from the farmer's own address are returned (the event indexes it), so
// the cost follows the farmer's batch count, not the size of the whole chain.
export async function getBatchCreatedEvents(farmerAddress) {
  const filter = batchCustody.filters.BatchCreated(null, farmerAddress);
  const logs = await readLogs((fromBlock, toBlock) =>
    batchCustody.queryFilter(filter, fromBlock, toBlock),
  );
  const timestamps = await getBlockTimestamps(logs);

  return logs.map((log) => ({
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    timestamp: timestamps.get(log.blockNumber),
  }));
}

export async function getReceiptEvents(address) {
  const filter = batchCustody.filters.ReceiptConfirmed(null, address);
  const logs = await readLogs((fromBlock, toBlock) =>
    batchCustody.queryFilter(filter, fromBlock, toBlock),
  );
  const timestamps = await getBlockTimestamps(logs);

  return logs.map((log) => ({
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    timestamp: timestamps.get(log.blockNumber),
    batchTopic: log.topics[1],
  }));
}

const STAGE_READ_BATCH_SIZE = 25;

export async function countBatchesByStage(batchIds) {
  const stages = [];
  for (let i = 0; i < batchIds.length; i += STAGE_READ_BATCH_SIZE) {
    const chunk = batchIds.slice(i, i + STAGE_READ_BATCH_SIZE);
    const batches = await Promise.all(
      chunk.map((batchId) => batchCustody.batches(batchId)),
    );
    for (const batch of batches) {
      if (Status[Number(batch.status)] !== "None") {
        stages.push(Stage[Number(batch.stage)]);
      }
    }
  }
  return countByStage(stages);
}

async function readLogs(readRange) {
  const toBlock = await provider.getBlockNumber();
  return readInPages(readRange, {
    fromBlock: config.DEPLOY_BLOCK,
    toBlock,
    pageSize: config.LOG_BLOCK_RANGE,
  });
}

async function getBlockTimestamps(logs) {
  const blockNumbers = [...new Set(logs.map((log) => log.blockNumber))];
  const blocks = await Promise.all(
    blockNumbers.map((n) => provider.getBlock(n)),
  );
  return new Map(
    blocks.map((block, index) => [blockNumbers[index], block.timestamp]),
  );
}
