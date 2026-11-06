import { id, ZeroHash } from "ethers";
import { registry, batchCustody, provider } from "./contracts.js";
import { ROLES, Status, Stage } from "./enums.js";
import { sameAddress } from "./addresses.js";
import { config } from "../config.js";
import { eventArgsToObject } from "./eventArgs.js";
import { readInPages } from "./logPages.js";

export { ROLES };

export async function getBatch(batchId) {
  const [batch, destination] = await Promise.all([
    batchCustody.batches(batchId),
    batchCustody.destinations(batchId),
  ]);
  return {
    status: Status[Number(batch.status)],
    stage: Stage[Number(batch.stage)],
    custodian: batch.custodian,
    pendingTarget: batch.pendingTarget,
    destination,
  };
}

export function hasRole(roleName, address) {
  return registry.hasRole(ROLES[roleName], address);
}

export function hasAdminRole(address) {
  return registry.hasRole(ZeroHash, address);
}

async function decodeReceipt(contract, txHash, toEvent) {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return null;

  const events = receipt.logs
    .filter((log) => sameAddress(log.address, contract.target))
    .flatMap((log) => {
      const parsed = contract.interface.parseLog(log);
      return parsed ? [toEvent(parsed, log)] : [];
    });

  return {
    success: receipt.status === 1,
    blockNumber: receipt.blockNumber,
    events,
  };
}

export function decodeTx(txHash) {
  // topics is kept alongside the decoded args: batchId is `string
  // indexed` on every BatchCustody event, so Solidity only stores its
  // keccak256 in the topic — ethers can't reconstruct the original
  // string from args, only the raw topic hash is usable (see how
  // getBatchHistory below matches batchId, same reasoning).
  return decodeReceipt(batchCustody, txHash, (parsed, log) => ({
    name: parsed.name,
    fragment: parsed.fragment,
    args: parsed.args,
    topics: log.topics,
  }));
}

export function decodeRegistryTx(txHash) {
  return decodeReceipt(registry, txHash, (parsed) => ({
    name: parsed.name,
    args: parsed.args,
  }));
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
