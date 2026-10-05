import { id } from "ethers";
import { registry, batchCustody, provider } from "./contracts.js";
import { Status, Stage } from "./enums.js";

const ROLE_NAMES = [
  "FARMER",
  "TRANSPORTER",
  "MILL",
  "STORAGE",
  "EXPORTER",
  "IMPORTER",
  "RETAILER",
];

export const ROLES = Object.fromEntries(
  ROLE_NAMES.map((name) => [name, id(`${name}_ROLE`)]),
);

export async function getBatch(batchId) {
  const b = await batchCustody.batches(batchId);
  return {
    status: Status[Number(b.status)],
    stage: Stage[Number(b.stage)],
    custodian: b.custodian,
    pendingTarget: b.pendingTarget,
  };
}

export function hasRole(roleName, address) {
  return registry.hasRole(ROLES[roleName], address);
}

export async function decodeTx(txHash) {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return null;

  const events = receipt.logs
    .filter(
      (log) => log.address.toLowerCase() === batchCustody.target.toLowerCase(),
    )
    .map((log) => batchCustody.interface.parseLog(log))
    .filter(Boolean)
    .map((parsed) => ({ name: parsed.name, args: parsed.args }));

  return {
    success: receipt.status === 1,
    blockNumber: receipt.blockNumber,
    events,
  };
}
