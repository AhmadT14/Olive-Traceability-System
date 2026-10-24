import { id } from "ethers";
import { computeRecordHash } from "./canonical.js";
import { decodeTx } from "../chain/reader.js";

export class HashMismatchError extends Error {
  constructor({ stageKey, txHash, onChainHash, computedHash }) {
    super(
      `hash mismatch for stage "${stageKey}": on-chain ${onChainHash} !== computed ${computedHash}`,
    );
    this.name = "HashMismatchError";
    this.stageKey = stageKey;
    this.txHash = txHash;
    this.onChainHash = onChainHash;
    this.computedHash = computedHash;
  }
}

export class EventNotFoundError extends Error {
  constructor({ stageKey, txHash, eventName, batchId }) {
    super(
      `tx ${txHash} has no "${eventName}" event for batch "${batchId}" (expected for stage "${stageKey}")`,
    );
    this.name = "EventNotFoundError";
    this.stageKey = stageKey;
    this.txHash = txHash;
    this.batchId = batchId;
  }
}

// Maps each defined HASH_FIELDS stage key to the contract event that carries
// its dataHash, and which argument on that event holds it. Only covers the
// stages HASH_FIELDS currently defines (farm, mill_olive, mill_oil, import,
// retail) — transporter/storage/export stages still need both their field
// lists (fields.js) and an entry here before they can go through this path.
const HASH_EVENTS = {
  farm: { event: "BatchCreated", arg: "harvestDataHash" },
  transporter_olive: { event: "BatchClaimed", arg: "intakeDataHash" },
  transporter_oil: { event: "BatchClaimed", arg: "intakeDataHash" },
  transporter_olive_outgoing: {
    event: "HandoverInitiated",
    arg: "outgoingDataHash",
  },
  transporter_oil_outgoing: {
    event: "HandoverInitiated",
    arg: "outgoingDataHash",
  },
  mill_olive: { event: "ReceiptConfirmed", arg: "intakeDataHash" },
  mill_oil: { event: "BatchListed", arg: "outgoingDataHash" },
  storage: { event: "ReceiptConfirmed", arg: "intakeDataHash" },
  storage_outgoing: { event: "BatchListed", arg: "outgoingDataHash" },
  import: { event: "ReceiptConfirmed", arg: "intakeDataHash" },
  retail: { event: "ReceiptConfirmed", arg: "intakeDataHash" },
};

/**
 * Recomputes the hash of `record` and compares it against the dataHash
 * actually emitted on-chain in `txHash`, for the specific `batchId` the
 * caller claims this record belongs to. Does not write anything — callers
 * decide what "reject the write" means for their route.
 *
 * Checking batchId matters because it is NOT one of the hashed fields (see
 * HASH_FIELDS) — without this check, a previously-mined, legitimate txHash
 * could be replayed against a different batchId with identical hash-field
 * values and would otherwise pass.
 *
 * @param {string} stageKey - a key in HASH_EVENTS / HASH_FIELDS
 * @param {string} txHash - the mined tx that's supposed to carry this record's hash
 * @param {string} batchId - the batch this record is being written for
 * @param {Record<string, unknown>} record - the incoming payload to verify
 * @returns {Promise<{ onChainHash: string, computedHash: string }>}
 * @throws {EventNotFoundError} if the tx has no matching event for this batch
 * @throws {HashMismatchError} if the hashes don't match
 */
export async function verifyRecordAgainstChain(
  stageKey,
  txHash,
  batchId,
  record,
) {
  const mapping = HASH_EVENTS[stageKey];
  if (!mapping) {
    throw new Error(
      `hashing: no on-chain event mapping defined for stage "${stageKey}"`,
    );
  }

  const decoded = await decodeTx(txHash);
  const expectedBatchTopic = id(batchId);

  if (!decoded || !decoded.success) {
    throw new EventNotFoundError({
      stageKey,
      txHash,
      eventName: mapping.event,
      batchId,
    });
  }

  // topics[0] is the event signature hash; topics[1] is batchId, the first
  // indexed param on every BatchCustody event this maps to.
  const match = decoded.events.find(
    (e) => e.name === mapping.event && e.topics[1] === expectedBatchTopic,
  );
  if (!match) {
    throw new EventNotFoundError({
      stageKey,
      txHash,
      eventName: mapping.event,
      batchId,
    });
  }

  const onChainHash = String(match.args[mapping.arg]).toLowerCase();
  const computedHash = computeRecordHash(stageKey, record).toLowerCase();

  if (onChainHash !== computedHash) {
    throw new HashMismatchError({
      stageKey,
      txHash,
      onChainHash,
      computedHash,
    });
  }

  return { onChainHash, computedHash };
}
