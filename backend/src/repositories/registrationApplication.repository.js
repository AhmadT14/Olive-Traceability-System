import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/db.js";
import { registrationApplications } from "../db/schema.js";

export function insert(values, exec = db) {
  return exec
    .insert(registrationApplications)
    .values({ ...values, status: "pending" })
    .returning();
}

export function findById(id, exec = db) {
  return exec
    .select()
    .from(registrationApplications)
    .where(eq(registrationApplications.id, id))
    .limit(1);
}

export function findLatestByWallet(walletAddress, exec = db) {
  return exec
    .select()
    .from(registrationApplications)
    .where(eq(registrationApplications.walletAddress, walletAddress))
    .orderBy(
      desc(registrationApplications.createdAt),
      desc(registrationApplications.id),
    )
    .limit(1);
}

export function list({ status, limit, offset = 0 } = {}, exec = db) {
  let query = exec
    .select()
    .from(registrationApplications)
    .where(status ? eq(registrationApplications.status, status) : undefined)
    .orderBy(
      desc(registrationApplications.createdAt),
      desc(registrationApplications.id),
    )
    .$dynamic();
  if (limit !== undefined) query = query.limit(limit);
  if (offset > 0) query = query.offset(offset);
  return query;
}

export function resolve(
  id,
  { status, reviewedBy, rejectionReason = null },
  exec = db,
) {
  return exec
    .update(registrationApplications)
    .set({ status, reviewedBy, rejectionReason, reviewedAt: sql`now()` })
    .where(
      and(
        eq(registrationApplications.id, id),
        eq(registrationApplications.status, "pending"),
      ),
    )
    .returning();
}
