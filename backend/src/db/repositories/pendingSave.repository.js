import { and, asc, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "../db.js";
import { pendingSaves } from "../schema.js";

export function insert(values, exec = db) {
  return exec
    .insert(pendingSaves)
    .values({ ...values, status: "pending" })
    .returning({ id: pendingSaves.id });
}

export function attachTxHash(id, walletAddress, txHash, exec = db) {
  return exec
    .update(pendingSaves)
    .set({ txHash })
    .where(
      and(
        eq(pendingSaves.id, id),
        eq(pendingSaves.walletAddress, walletAddress),
        eq(pendingSaves.status, "pending"),
        isNull(pendingSaves.txHash),
      ),
    )
    .returning({ id: pendingSaves.id });
}

export function findByTxHash(txHash, exec = db) {
  return exec
    .select()
    .from(pendingSaves)
    .where(eq(pendingSaves.txHash, txHash))
    .limit(1);
}

export function findPendingByBatchAndHash(batchId, dataHash, exec = db) {
  return exec
    .select()
    .from(pendingSaves)
    .where(
      and(
        eq(pendingSaves.batchId, batchId),
        eq(pendingSaves.dataHash, dataHash),
        eq(pendingSaves.status, "pending"),
      ),
    )
    .orderBy(asc(pendingSaves.createdAt), asc(pendingSaves.id))
    .limit(1);
}

export function listPending(limit, exec = db) {
  return exec
    .select()
    .from(pendingSaves)
    .where(eq(pendingSaves.status, "pending"))
    .orderBy(asc(pendingSaves.createdAt), asc(pendingSaves.id))
    .limit(limit);
}

export function listForWallet(
  walletAddress,
  { limit, offset = 0 } = {},
  exec = db,
) {
  let query = exec
    .select()
    .from(pendingSaves)
    .where(eq(pendingSaves.walletAddress, walletAddress))
    .orderBy(desc(pendingSaves.createdAt), desc(pendingSaves.id))
    .$dynamic();
  if (limit !== undefined) query = query.limit(limit);
  if (offset > 0) query = query.offset(offset);
  return query;
}

export function resolve(
  id,
  { status, txHash, failureReason = null },
  exec = db,
) {
  const patch = { status, failureReason, resolvedAt: sql`now()` };
  if (txHash !== undefined) patch.txHash = txHash;
  return exec
    .update(pendingSaves)
    .set(patch)
    .where(and(eq(pendingSaves.id, id), eq(pendingSaves.status, "pending")))
    .returning({ id: pendingSaves.id });
}

export function deleteFailedBefore(cutoff, exec = db) {
  return exec
    .delete(pendingSaves)
    .where(
      and(
        eq(pendingSaves.status, "failed"),
        lt(pendingSaves.resolvedAt, cutoff),
      ),
    )
    .returning({ id: pendingSaves.id });
}
