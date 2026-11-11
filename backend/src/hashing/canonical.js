import { keccak256, toUtf8Bytes } from "ethers";
import { HASH_FIELDS } from "./fields.js";

const DECIMAL_FIELDS = new Set([
  "quantity",
  "quantity_received",
  "quantity_shipped",
  "quantity_released",
  "quantity_picked_up",
  "quantity_delivered",
  "output_quantity",
]);

function normalizeDecimal(value) {
  const trimmed = String(value).trim();
  if (trimmed === "") return "";
  const num = Number(trimmed);

  return Number.isFinite(num) ? num.toFixed(2) : trimmed;
}

export function normalizeValue(field, value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (DECIMAL_FIELDS.has(field)) return normalizeDecimal(value);
  return String(value).trim();
}

export function canonicalValues(stageKey, record) {
  const fields = HASH_FIELDS[stageKey];
  if (!fields) {
    throw new Error(`hashing: no field list defined for stage "${stageKey}"`);
  }
  return fields.map((field) => normalizeValue(field, record[field]));
}

export function computeRecordHash(stageKey, record) {
  const values = canonicalValues(stageKey, record);
  return keccak256(toUtf8Bytes(JSON.stringify(values)));
}
