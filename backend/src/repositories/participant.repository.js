import { eq, inArray } from "drizzle-orm";
import { db } from "../db/db.js";
import { participantProfiles, participants } from "../db/schema.js";

export function findByWallet(walletAddress, exec = db) {
  return exec
    .select({ walletAddress: participants.walletAddress })
    .from(participants)
    .where(eq(participants.walletAddress, walletAddress))
    .limit(1);
}

export async function exists(walletAddress, exec = db) {
  const rows = await findByWallet(walletAddress, exec);
  return rows.length > 0;
}

export function listWithNames(exec = db) {
  return exec
    .select({
      address: participants.walletAddress,
      name: participantProfiles.name,
    })
    .from(participants)
    .leftJoin(
      participantProfiles,
      eq(participantProfiles.walletAddress, participants.walletAddress),
    );
}

export function listWithNamesByWallets(wallets, exec = db) {
  if (wallets.length === 0) return Promise.resolve([]);
  return exec
    .select({
      walletAddress: participants.walletAddress,
      name: participantProfiles.name,
    })
    .from(participants)
    .leftJoin(
      participantProfiles,
      eq(participantProfiles.walletAddress, participants.walletAddress),
    )
    .where(inArray(participants.walletAddress, wallets));
}

export function insertIgnore(walletAddress, exec = db) {
  return exec
    .insert(participants)
    .values({ walletAddress })
    .onConflictDoNothing();
}

export function upsertProfile(values, updates, exec = db) {
  return exec
    .insert(participantProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: participantProfiles.walletAddress,
      set: updates,
    });
}
