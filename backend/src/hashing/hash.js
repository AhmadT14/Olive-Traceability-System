import { keccak256, toUtf8Bytes } from "ethers";
import { HASH_FIELDS } from "./fields.js";

const DECIMAL_FIELDS = new Set([
  "quantity",
  "quantity_received",
  "quantity_shipped",
  "quantity_picked_up",
  "quantity_delivered",
  "output_quantity",
  "processing_capacity",
  "storage_capacity",
]);

function normalizeDecimal(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return num.toFixed(2);
}

export function normalize(field, value) {
  if (value === undefined || value === null) return null;

  if (DECIMAL_FIELDS.has(field)) {
    return normalizeDecimal(value);
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }

  return String(value);
}

export function computeDataHash(eventType, batchId, row) {
  const fields = HASH_FIELDS[eventType];
  if (!fields) {
    throw new Error(`Unknown hash event type: ${eventType}`);
  }

  const payload = {
    eventType,
    batchId,
  };
  for (const field of fields) {
    payload[field] = normalize(field, row[field]);
  }

  const json = JSON.stringify(payload);
  return keccak256(toUtf8Bytes(json));
}
