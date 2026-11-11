import { id, ZeroHash } from "ethers";
import { registry, batchCustody, provider } from "./contracts.js";
import { ROLES, Status, Stage } from "./enums.js";
import { sameAddress } from "./addresses.js";
import * as chainEventRepository from "../db/repositories/chainEvent.repository.js";
import { syncEvents } from "./eventIndex.js";

export { ROLES };

export async function getBatch(batchId) {
  const [batch, destination, reservedBy] = await Promise.all([
    batchCustody.batches(batchId),
    batchCustody.destinations(batchId),
    batchCustody.reservedBy(batchId),
  ]);
  return {
    status: Status[Number(batch.status)],
    stage: Stage[Number(batch.stage)],
    custodian: batch.custodian,
    pendingTarget: batch.pendingTarget,
    destination,
    reservedBy,
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

export function decodeCustodyTx(txHash) {
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

export async function getBatchHistory(batchId) {
  await syncEvents();
  const rows = await chainEventRepository.listByBatchTopic(id(batchId));
  return rows.map((row) => ({
    name: row.eventName,
    txHash: row.txHash,
    blockNumber: row.blockNumber,
    args: row.args,
  }));
}

export async function getBatchCreatedEvents(address) {
  await syncEvents();
  const rows = await chainEventRepository.listByEventAndAddress(
    "BatchCreated",
    address.toLowerCase(),
  );
  return rows
    .filter((row) => sameAddress(row.args.farmer, address))
    .map((row) => ({
      txHash: row.txHash,
      blockNumber: row.blockNumber,
      timestamp: Math.floor(new Date(row.blockTime).getTime() / 1000),
    }));
}
