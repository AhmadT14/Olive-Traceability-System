import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { transporterJobs } from "../db/schema.js";

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
    .select({ id: transporterJobs.id, destinationParty: transporterJobs.destinationParty })
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

export function listAvailable(exec = db) {
  return exec
    .select({
      id: transporterJobs.id,
      batchId: transporterJobs.batchId,
      sourceParty: transporterJobs.sourceParty,
      destinationParty: transporterJobs.destinationParty,
      listingTxHash: transporterJobs.listingTxHash,
      createdAt: transporterJobs.createdAt,
    })
    .from(transporterJobs)
    .where(eq(transporterJobs.status, "available"));
}
