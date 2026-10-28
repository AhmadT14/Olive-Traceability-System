import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { batches } from "../db/schema.js";

export function findById(batchId, exec = db) {
  return exec
    .select({ batchId: batches.batchId })
    .from(batches)
    .where(eq(batches.batchId, batchId))
    .limit(1);
}

export async function existsById(batchId, exec = db) {
  const rows = await findById(batchId, exec);
  return rows.length > 0;
}

export function insert(batchId, exec = db) {
  return exec.insert(batches).values({ batchId });
}
