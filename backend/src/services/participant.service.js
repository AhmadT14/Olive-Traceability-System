import { ROLES, hasRole } from "../chain/reader.js";
import { AppError, internalError, notFound } from "../errors.js";
import * as participantRepository from "../repositories/participant.repository.js";
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

// What the public consumer page may show about a facility. Contact details
// (phone, email, postal address) stay private to the participant.
export async function getPublicProfile(rawAddress) {
  const address = parseWalletAddress(rawAddress);

  try {
    const wallet = address.toLowerCase();
    const [row, roles] = await Promise.all([
      participantRepository.findProfile(wallet),
      readRoles(address),
    ]);
    if (!row) throw notFound("participant not found");
    return {
      address: wallet,
      name: row.name ?? null,
      location: row.location ?? null,
      roles,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("participant lookup failed", err);
  }
}
