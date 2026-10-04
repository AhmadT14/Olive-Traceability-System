import { id } from "ethers";
import { registry, batchCustody } from "./contracts.js";
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
