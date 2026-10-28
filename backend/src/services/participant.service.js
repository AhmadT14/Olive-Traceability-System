import { isAddress } from "ethers";
import { ROLES, hasRole } from "../chain/reader.js";
import { badRequest, internalError } from "../errors.js";

// Reads every registry role an address currently holds.
export async function readRoles(address) {
  const names = Object.keys(ROLES);
  const results = await Promise.all(
    names.map((name) => hasRole(name, address)),
  );
  return names.filter((_, index) => results[index]);
}

export async function getParticipantRoles(address) {
  if (!isAddress(address)) throw badRequest("invalid address");

  try {
    return { address, roles: await readRoles(address) };
  } catch (err) {
    throw internalError("chain read failed", err);
  }
}
