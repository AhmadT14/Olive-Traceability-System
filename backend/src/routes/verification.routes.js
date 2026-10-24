import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { batchEvents } from "../db/schema.js";
import { getBatch } from "../chain/reader.js";
import {
  EventNotFoundError,
  HashMismatchError,
  verifyRecordAgainstChain,
} from "../hashing/verify.js";

const router = Router();

const VERIFIABLE_EVENT_TYPES = {
  farm: { stageKey: "farm", contractEvent: "BatchCreated" },
  transporter_olive_pickup: {
    stageKey: "transporter_olive",
    contractEvent: "BatchClaimed",
  },
  transporter_oil_pickup: {
    stageKey: "transporter_oil",
    contractEvent: "BatchClaimed",
  },
  transporter_olive_delivery: {
    stageKey: "transporter_olive_outgoing",
    contractEvent: "HandoverInitiated",
  },
  transporter_oil_delivery: {
    stageKey: "transporter_oil_outgoing",
    contractEvent: "HandoverInitiated",
  },
  mill_intake: { stageKey: "mill_olive", contractEvent: "ReceiptConfirmed" },
  mill_outgoing: { stageKey: "mill_oil", contractEvent: "BatchListed" },
  storage_intake: { stageKey: "storage", contractEvent: "ReceiptConfirmed" },
  storage_outgoing: { stageKey: "storage_outgoing", contractEvent: "BatchListed" },
  exporter_intake: { stageKey: "exporter_intake", contractEvent: "ReceiptConfirmed" },
  exporter_outgoing: { stageKey: "exporter_outgoing", contractEvent: "BatchListed" },
  importer_intake: { stageKey: "import", contractEvent: "ReceiptConfirmed" },
  importer_outgoing: { stageKey: "importer_outgoing", contractEvent: "BatchListed" },
  retailer_intake: { stageKey: "retail", contractEvent: "ReceiptConfirmed" },
};

async function verifyEvent(batchId, event) {
  const expected = VERIFIABLE_EVENT_TYPES[event.detailsType];
  if (!expected) {
    return { status: "unverifiable", reason: "no hash field definition for this event type" };
  }
  if (event.payloadVersion !== 1) {
    return { status: "unverifiable", reason: "unsupported payload version" };
  }
  if (event.contractEvent !== expected.contractEvent) {
    return { status: "metadata_mismatch", expectedEvent: expected.contractEvent };
  }

  try {
    const result = await verifyRecordAgainstChain(
      expected.stageKey,
      event.eventTxHash,
      batchId,
      event.details,
    );
    return {
      status: "verified",
      onChainHash: result.onChainHash,
      computedHash: result.computedHash,
    };
  } catch (err) {
    if (err instanceof HashMismatchError) {
      return {
        status: "hash_mismatch",
        onChainHash: err.onChainHash,
        computedHash: err.computedHash,
      };
    }
    if (err instanceof EventNotFoundError) {
      return { status: "event_not_found_on_chain" };
    }
    throw err;
  }
}

router.get("/batches/:id/verify", async (req, res) => {
  const batchId = req.params.id.trim();
  if (!batchId || batchId.length > 64) {
    return res.status(400).json({ error: "invalid batch id" });
  }

  let batch;
  try {
    batch = await getBatch(batchId);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }
  if (batch.status === "None") {
    return res.status(404).json({ error: "batch not found" });
  }

  let storedEvents;
  try {
    storedEvents = await db
      .select()
      .from(batchEvents)
      .where(eq(batchEvents.batchId, batchId))
      .orderBy(asc(batchEvents.recordedAt), asc(batchEvents.eventTxHash));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "event details lookup failed" });
  }

  try {
    const events = await Promise.all(
      storedEvents.map(async (event) => ({
        txHash: event.eventTxHash,
        contractEvent: event.contractEvent,
        detailsType: event.detailsType,
        payloadVersion: event.payloadVersion,
        recordedAt: event.recordedAt,
        details: event.details,
        integrity: await verifyEvent(batchId, event),
      })),
    );
    const statuses = events.map((event) => event.integrity.status);
    const integrityStatus =
      statuses.length > 0 && statuses.every((status) => status === "verified")
        ? "verified"
        : statuses.some((status) =>
              ["hash_mismatch", "metadata_mismatch"].includes(status),
            )
          ? "mismatch"
          : "incomplete";

    return res.json({
      batch: { batchId, ...batch },
      integrityStatus,
      events,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "chain verification failed" });
  }
});

export default router;
