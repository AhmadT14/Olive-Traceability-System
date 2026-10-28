import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/db.js";
import { batchEvents } from "../db/schema.js";

export function findByTxHash(txHash, exec = db) {
  return exec
    .select({ eventTxHash: batchEvents.eventTxHash })
    .from(batchEvents)
    .where(eq(batchEvents.eventTxHash, txHash))
    .limit(1);
}

export async function existsByTxHash(txHash, exec = db) {
  const rows = await findByTxHash(txHash, exec);
  return rows.length > 0;
}

export function findByBatchAndType(batchId, detailsType, exec = db) {
  return exec
    .select({ eventTxHash: batchEvents.eventTxHash })
    .from(batchEvents)
    .where(
      and(
        eq(batchEvents.batchId, batchId),
        eq(batchEvents.detailsType, detailsType),
      ),
    )
    .limit(1);
}

export async function existsByBatchAndType(batchId, detailsType, exec = db) {
  const rows = await findByBatchAndType(batchId, detailsType, exec);
  return rows.length > 0;
}

export function insert(values, exec = db) {
  return exec.insert(batchEvents).values(values);
}

// Full rows, used by the integrity verification route.
export function findByBatchId(batchId, exec = db) {
  return exec
    .select()
    .from(batchEvents)
    .where(eq(batchEvents.batchId, batchId))
    .orderBy(asc(batchEvents.recordedAt), asc(batchEvents.eventTxHash));
}

// Projected rows, used by the history route.
export function findDetailsByBatchId(batchId, exec = db) {
  return exec
    .select({
      eventTxHash: batchEvents.eventTxHash,
      detailsType: batchEvents.detailsType,
      payloadVersion: batchEvents.payloadVersion,
      details: batchEvents.details,
      recordedAt: batchEvents.recordedAt,
    })
    .from(batchEvents)
    .where(eq(batchEvents.batchId, batchId))
    .orderBy(asc(batchEvents.recordedAt));
}

export function findByTxHashes(txHashes, exec = db) {
  if (txHashes.length === 0) return Promise.resolve([]);
  return exec
    .select({
      eventTxHash: batchEvents.eventTxHash,
      detailsType: batchEvents.detailsType,
      details: batchEvents.details,
    })
    .from(batchEvents)
    .where(inArray(batchEvents.eventTxHash, txHashes));
}
