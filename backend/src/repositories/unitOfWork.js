import { db } from "../db/db.js";

export function runInTransaction(work) {
  return db.transaction((exec) => work(exec));
}
