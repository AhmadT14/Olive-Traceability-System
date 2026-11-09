import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/db.js";
import { batchEvents, transporterJobs } from "../db/schema.js";

const jobColumns = {
  id: transporterJobs.id,
  status: transporterJobs.status,
  batchId: transporterJobs.batchId,
  sourceParty: transporterJobs.sourceParty,
  destinationParty: transporterJobs.destinationParty,
  transporter: transporterJobs.transporter,
  listingTxHash: transporterJobs.listingTxHash,
  reservedAt: transporterJobs.reservedAt,
  createdAt: transporterJobs.createdAt,
};

export function insert(values, exec = db) {
  return exec.insert(transporterJobs).values(values);
}

export function findAvailableByBatch(batchId, exec = db) {
  return exec
    .select({ id: transporterJobs.id })
    .from(transporterJobs)
    .where(
      and(
        eq(transporterJobs.batchId, batchId),
        eq(transporterJobs.status, "available"),
      ),
    )
    .limit(1);
}

export function findPendingHandoverForDestination(
  batchId,
  destinationParty,
  exec = db,
) {
  return exec
    .select({ id: transporterJobs.id })
    .from(transporterJobs)
    .where(
      and(
        eq(transporterJobs.batchId, batchId),
        eq(transporterJobs.destinationParty, destinationParty),
        eq(transporterJobs.status, "handover_pending"),
      ),
    )
    .limit(1);
}

export function findClaimedForTransporter(batchId, transporter, exec = db) {
  return exec
    .select({
      id: transporterJobs.id,
      destinationParty: transporterJobs.destinationParty,
    })
    .from(transporterJobs)
    .where(
      and(
        eq(transporterJobs.batchId, batchId),
        eq(transporterJobs.transporter, transporter),
        eq(transporterJobs.status, "claimed"),
      ),
    )
    .orderBy(desc(transporterJobs.createdAt))
    .limit(1);
}

export function findClaimedForHandover(
  batchId,
  transporter,
  destinationParty,
  exec = db,
) {
  return exec
    .select({ id: transporterJobs.id })
    .from(transporterJobs)
    .where(
      and(
        eq(transporterJobs.batchId, batchId),
        eq(transporterJobs.transporter, transporter),
        eq(transporterJobs.destinationParty, destinationParty),
        eq(transporterJobs.status, "claimed"),
      ),
    )
    .orderBy(desc(transporterJobs.createdAt))
    .limit(1);
}

// Atomically moves a job from one status to another. Returns the updated rows
// so the service can detect a concurrent transition (0 rows == state changed).
export function transition(id, fromStatus, patch, exec = db) {
  return exec
    .update(transporterJobs)
    .set(patch)
    .where(
      and(eq(transporterJobs.id, id), eq(transporterJobs.status, fromStatus)),
    )
    .returning({ id: transporterJobs.id });
}

export async function findById(id, exec = db) {
  const rows = await exec
    .select(jobColumns)
    .from(transporterJobs)
    .where(eq(transporterJobs.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function findClaimableForTransporter(
  batchId,
  transporter,
  exec = db,
) {
  const rows = await exec
    .select({
      id: transporterJobs.id,
      status: transporterJobs.status,
      transporter: transporterJobs.transporter,
    })
    .from(transporterJobs)
    .where(
      and(
        eq(transporterJobs.batchId, batchId),
        inArray(transporterJobs.status, ["available", "reserved"]),
      ),
    )
    .orderBy(
      sql`case when ${transporterJobs.transporter} = ${transporter} then 0 when ${transporterJobs.status} = 'available' then 1 else 2 end`,
      desc(transporterJobs.createdAt),
    )
    .limit(1);
  return rows[0] ?? null;
}

export function releaseReservation(id, transporter, exec = db) {
  return exec
    .update(transporterJobs)
    .set({ status: "available", transporter: null, reservedAt: null })
    .where(
      and(
        eq(transporterJobs.id, id),
        eq(transporterJobs.status, "reserved"),
        eq(transporterJobs.transporter, transporter),
      ),
    )
    .returning({ id: transporterJobs.id });
}

export function listActiveForTransporter(transporter, exec = db) {
  return exec
    .select(jobColumns)
    .from(transporterJobs)
    .where(
      and(
        eq(transporterJobs.transporter, transporter),
        inArray(transporterJobs.status, [
          "reserved",
          "claimed",
          "handover_pending",
        ]),
      ),
    )
    .orderBy(desc(transporterJobs.createdAt));
}

export function listCompletedForTransporter(transporter, exec = db) {
  return exec
    .select(jobColumns)
    .from(transporterJobs)
    .where(
      and(
        eq(transporterJobs.transporter, transporter),
        eq(transporterJobs.status, "completed"),
      ),
    )
    .orderBy(desc(transporterJobs.createdAt), desc(transporterJobs.id));
}

export function listReceivedByParty(party, { limit, offset }, exec = db) {
  let query = exec
    .select({
      batchId: transporterJobs.batchId,
      txHash: transporterJobs.receiptTxHash,
      receivedAt: batchEvents.recordedAt,
      details: batchEvents.details,
    })
    .from(transporterJobs)
    .innerJoin(
      batchEvents,
      and(
        eq(batchEvents.batchId, transporterJobs.batchId),
        eq(batchEvents.eventTxHash, transporterJobs.receiptTxHash),
      ),
    )
    .where(
      and(
        eq(transporterJobs.destinationParty, party),
        eq(transporterJobs.status, "completed"),
      ),
    )
    .orderBy(desc(batchEvents.recordedAt), desc(transporterJobs.id))
    .$dynamic();
  if (limit !== undefined) query = query.limit(limit);
  if (offset > 0) query = query.offset(offset);
  return query;
}

export function listAvailable(exec = db) {
  return exec
    .select(jobColumns)
    .from(transporterJobs)
    .where(eq(transporterJobs.status, "available"))
    .orderBy(desc(transporterJobs.createdAt), desc(transporterJobs.id));
}
