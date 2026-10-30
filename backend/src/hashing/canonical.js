import { keccak256, toUtf8Bytes } from "ethers";
import { HASH_FIELDS } from "./fields.js";

// The single hashing scheme for off-chain records. prepare.service computes
// the dataHash that goes on-chain with computeRecordHash, and verify.js
// recomputes it with the same function, so every hash must come from here.
//
// Scheme: take the stage's field list from HASH_FIELDS in its declared order,
// normalize each value to a string, JSON-encode the array, keccak256 the
// UTF-8 bytes. batchId is deliberately not part of the payload; verify.js
// binds the hash to a batch by checking the event's indexed batchId topic.

// Fields stored as decimals. Clients may send 12.5, "12.5" or "12.50" for the
// same quantity, so these are rounded to two places before hashing.
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
  // Keep a non-numeric string as-is so distinct bad inputs never collapse
  // into the same hash.
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