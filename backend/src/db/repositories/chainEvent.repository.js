import { and, arrayContains, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../db.js";
import { chainEvents, chainSyncState } from "../schema.js";

export function insertMany(rows, exec = db) {
  if (rows.length === 0) return Promise.resolve([]);
  return exec
    .insert(chainEvents)
    .values(rows)
    .onConflictDoNothing({ target: [chainEvents.txHash, chainEvents.logIndex] })
    .returning({ id: chainEvents.id });
}

export function listByBatchTopic(batchTopic, exec = db) {
  return exec
    .select()
    .from(chainEvents)
    .where(eq(chainEvents.batchTopic, batchTopic))
    .orderBy(asc(chainEvents.blockNumber), asc(chainEvents.logIndex));
}

export function listByEventAndAddress(
  eventName,
  address,
  { limit, offset = 0 } = {},
  exec = db,
) {
  let query = exec
    .select()
    .from(chainEvents)
    .where(
      and(
        eq(chainEvents.eventName, eventName),
        arrayContains(chainEvents.addresses, [address]),
      ),
    )
    .orderBy(desc(chainEvents.blockNumber), desc(chainEvents.logIndex))
    .$dynamic();
  if (limit !== undefined) query = query.limit(limit);
  if (offset > 0) query = query.offset(offset);
  return query;
}

export function listBatchTopicsByAddress(address, exec = db) {
  return exec
    .selectDistinct({ batchTopic: chainEvents.batchTopic })
    .from(chainEvents)
    .where(
      and(
        arrayContains(chainEvents.addresses, [address]),
        isNotNull(chainEvents.batchTopic),
      ),
    );
}

export async function getCursor(name, exec = db) {
  const rows = await exec
    .select({ lastBlock: chainSyncState.lastBlock })
    .from(chainSyncState)
    .where(eq(chainSyncState.name, name))
    .limit(1);
  return rows[0]?.lastBlock ?? null;
}

export function setCursor(name, lastBlock, exec = db) {
  return exec
    .insert(chainSyncState)
    .values({ name, lastBlock })
    .onConflictDoUpdate({
      target: chainSyncState.name,
      set: { lastBlock, updatedAt: sql`now()` },
    });
}
