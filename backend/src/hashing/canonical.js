import { keccak256, toUtf8Bytes } from "ethers";
import { HASH_FIELDS } from "./fields.js";

function normalizeValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return String(value);
  return String(value).trim();
}
export function canonicalValues(stageKey, record) {
  const fields = HASH_FIELDS[stageKey];
  if (!fields) {
    throw new Error(`hashing: no field list defined for stage "${stageKey}"`);
  }
  return fields.map((field) => normalizeValue(record[field]));
}

export function computeRecordHash(stageKey, record) {
  const values = canonicalValues(stageKey, record);
  const canonicalJson = JSON.stringify(values);
  return keccak256(toUtf8Bytes(canonicalJson));
}
