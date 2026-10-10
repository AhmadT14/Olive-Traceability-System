import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { millOliveRecords, batches } from "../db/schema.js";
import {
  verifyRecordAgainstChain,
  HashMismatchError,
  EventNotFoundError,
} from "../hashing/verify.js";

const router = Router();

// Matches HASH_FIELDS.mill_olive exactly — see the note in batches.routes.js
// on why these stay snake_case rather than the Drizzle camelCase names.
const millIntakeSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a tx hash"),
  arrival_condition: z.string().optional(),
  quantity_received: z.union([z.string(), z.number()]).optional(),
  olive_quality: z.string().optional(),
  storage_condition: z.string().optional(),
  notes: z.string().optional(),
});

router.post("/batches/:id/mill-intake", async (req, res) => {
  const batchId = req.params.id.trim();
  if (!batchId || batchId.length > 64) {
    return res.status(400).json({ error: "invalid batch id" });
  }

  const parsed = millIntakeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid payload", details: parsed.error.flatten() });
  }

  const { txHash, ...record } = parsed.data;

  try {
    await verifyRecordAgainstChain("mill_olive", txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) {
      return res
        .status(409)
        .json({ error: "record does not match the on-chain hash" });
    }
    if (err instanceof EventNotFoundError) {
      return res
        .status(404)
        .json({ error: "tx not found or has no ReceiptConfirmed event for this batch" });
    }
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }

  try {
    const batchExists = await db
      .select({ batchId: batches.batchId })
      .from(batches)
      .where(eq(batches.batchId, batchId))
      .limit(1);
    if (batchExists.length === 0) {
      return res
        .status(409)
        .json({ error: "batch has no off-chain create record yet" });
    }

    const existing = await db
      .select({ eventTxHash: millOliveRecords.eventTxHash })
      .from(millOliveRecords)
      .where(eq(millOliveRecords.eventTxHash, txHash))
      .limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "record already recorded off-chain" });
    }

    await db.insert(millOliveRecords).values({
      eventTxHash: txHash,
      batchId,
      arrivalCondition: record.arrival_condition,
      quantityReceived: record.quantity_received,
      oliveQuality: record.olive_quality,
      storageCondition: record.storage_condition,
      notes: record.notes,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "db write failed" });
  }

  res.status(201).json({ batchId, txHash });
});

export default router;