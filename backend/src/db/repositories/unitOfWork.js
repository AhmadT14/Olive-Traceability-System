import { db } from "../db.js";

export function runInTransaction(work) {
  return db.transaction((exec) => work(exec));
}
