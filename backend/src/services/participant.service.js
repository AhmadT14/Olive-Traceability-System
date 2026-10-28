import { ROLES, hasRole } from "../chain/reader.js";
import { internalError } from "../errors.js";
import { parseWalletAddress } from "../validation/parse.js";

// Reads every registry role an address currently holds.
export async function readRoles(address) {
  const names = Object.keys(ROLES);
  const results = await Promise.all(
    names.map((name) => hasRole(name, address)),
  );
  return names.filter((_, index) => results[index]);
}

export async function getParticipantRoles(rawAddress) {
  const address = parseWalletAddress(rawAddress);

  try {
    return { address, roles: await readRoles(address) };
  } catch (err) {
    throw internalError("chain read failed", err);
  }
}
