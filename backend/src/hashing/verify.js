import { id } from "ethers";
import { computeRecordHash } from "./canonical.js";
import { decodeCustodyTx } from "../chain/reader.js";

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
  exporter_intake: { event: "ReceiptConfirmed", arg: "intakeDataHash" },
  exporter_outgoing: { event: "BatchListed", arg: "outgoingDataHash" },
  import: { event: "ReceiptConfirmed", arg: "intakeDataHash" },
  importer_outgoing: { event: "BatchListed", arg: "outgoingDataHash" },
  retail: { event: "ReceiptConfirmed", arg: "intakeDataHash" },
};

export async function verifyRecordAgainstChain(
  stageKey,
  txHash,
  batchId,
  record,
  decodedTx,
) {
  const mapping = HASH_EVENTS[stageKey];
  if (!mapping) {
    throw new Error(
      `hashing: no on-chain event mapping defined for stage "${stageKey}"`,
    );
  }

  const decoded = decodedTx ?? (await decodeCustodyTx(txHash));
  const expectedBatchTopic = id(batchId);

  if (!decoded || !decoded.success) {
    throw new EventNotFoundError({
      stageKey,
      txHash,
      eventName: mapping.event,
      batchId,
    });
  }

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

  return { onChainHash, computedHash, decoded };
}
