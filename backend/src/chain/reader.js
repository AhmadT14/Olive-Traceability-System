import { id, ZeroHash } from "ethers";
import { registry, batchCustody, provider } from "./contracts.js";
import { RoleNames, Status, Stage } from "./enums.js";
import { config } from "../config.js";

export const ROLES = Object.fromEntries(
  RoleNames.map((name) => [name, id(`${name}_ROLE`)]),
);

export async function getBatch(batchId) {
  const b = await batchCustody.batches(batchId);
  return {
    status: Status[Number(b.status)],
    stage: Stage[Number(b.stage)],
    custodian: b.custodian,
    pendingTarget: b.pendingTarget,
    destination: await batchCustody.destinations(batchId),
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
        parsed && { name: parsed.name, args: parsed.args, topics: log.topics }
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

export async function getBatchHistory(batchId) {
  const logs = await batchCustody.queryFilter("*", config.DEPLOY_BLOCK);

  const topic = id(batchId);

  return logs
    .filter((log) => log.topics[1] === topic)
    .map((log) => ({
      name: log.fragment.name,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      args: Object.fromEntries(
        log.args
          .toArray()
          .map((value, i) => [log.fragment.inputs[i].name, String(value)]),
      ),
    }));
}

// Every BatchCreated event for one farmer, with the time of its block. Only
// events from the farmer's own address are returned (the event indexes it), so
// the cost follows the farmer's batch count, not the size of the whole chain.
export async function getBatchCreatedEvents(farmerAddress) {
  const logs = await batchCustody.queryFilter(
    batchCustody.filters.BatchCreated(null, farmerAddress),
    config.DEPLOY_BLOCK,
  );

  const blockNumbers = [...new Set(logs.map((log) => log.blockNumber))];
  const blocks = await Promise.all(
    blockNumbers.map((n) => provider.getBlock(n)),
  );
  const timestamps = new Map(
    blocks.map((block, index) => [blockNumbers[index], block.timestamp]),
  );

  return logs.map((log) => ({
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    timestamp: timestamps.get(log.blockNumber),
  }));
}
