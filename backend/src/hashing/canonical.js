import { keccak256, toUtf8Bytes } from "ethers";
import { HASH_FIELDS } from "./fields.js";

// ───────────────────────── canonical encoding ─────────────────────────
//
// The contract stores each dataHash opaquely (see BatchCustody.t.sol) — it
// never computes or checks it. This file is therefore the *only* place the
// scheme is defined. Whatever builds a transaction (this backend, or later
// a frontend) and whatever verifies a record afterward MUST both go through
// computeRecordHash, or the hashes will silently diverge.
//
// Scheme: take the field list for a stage from HASH_FIELDS, in that fixed
// order, normalize each value to a string, JSON-encode the resulting array,
// and keccak256 the UTF-8 bytes. Field order comes from HASH_FIELDS (not
// from object key order) specifically so that adding unrelated columns to a
// table, or receiving JSON keys in a different order, never changes the
// hash.

function normalizeValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10); // YYYY-MM-DD
  if (typeof value === "number") return String(value);
  // Postgres numeric columns come back as strings already (e.g. "12.50");
  // leave them as-is rather than round-tripping through Number().
  return String(value).trim();
}

/**
 * @param {string} stageKey - a key in HASH_FIELDS, e.g. "farm", "mill_olive"
 * @param {Record<string, unknown>} record - the incoming row/payload
 * @returns {string[]} the ordered, normalized values that get hashed
 */
export function canonicalValues(stageKey, record) {
  const fields = HASH_FIELDS[stageKey];
  if (!fields) {
    throw new Error(`hashing: no field list defined for stage "${stageKey}"`);
  }
  return fields.map((field) => normalizeValue(record[field]));
}

/**
 * Computes the keccak256 dataHash for a record, the same way regardless of
 * whether it's about to be sent on-chain or checked against what already is.
 * @param {string} stageKey
 * @param {Record<string, unknown>} record
 * @returns {string} 0x-prefixed 32-byte hash
 */
export function computeRecordHash(stageKey, record) {
  const values = canonicalValues(stageKey, record);
  const canonicalJson = JSON.stringify(values);
  return keccak256(toUtf8Bytes(canonicalJson));
}