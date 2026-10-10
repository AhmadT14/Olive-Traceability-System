import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { batches, farmRecords } from "../db/schema.js";
import {
  verifyRecordAgainstChain,
  HashMismatchError,
  EventNotFoundError,
} from "../hashing/verify.js";

const router = Router();

// Field names here deliberately match HASH_FIELDS.farm (snake_case) rather
// than the camelCase Drizzle column names, since this payload is exactly
// what gets passed into computeRecordHash — keeping the keys identical
// avoids a second mapping that could drift out of sync with fields.js.
const createBatchSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a tx hash"),
  batchId: z.string().min(1).max(64),
  farmer: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address"),
  harvest_date: z.string(), // YYYY-MM-DD
  location: z.string().max(255),
  olive_type: z.string().max(128),
  quantity: z.union([z.string(), z.number()]).optional(),
  cultivation_method: z.string().optional(),
  irrigation_method: z.string().optional(),
  fertilizer_details: z.string().optional(),
  pesticide_details: z.string().optional(),
  harvesting_method: z.string().optional(),
  quality_details: z.string().optional(),
  farm_notes: z.string().optional(),
});

router.post("/batches", async (req, res) => {
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid payload", details: parsed.error.flatten() });
  }

  const { txHash, batchId, farmer, ...record } = parsed.data;

  try {
    await verifyRecordAgainstChain("farm", txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) {
      return res
        .status(409)
        .json({ error: "record does not match the on-chain hash" });
    }
    if (err instanceof EventNotFoundError) {
      return res
        .status(404)
        .json({ error: "tx not found or has no BatchCreated event" });
    }
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }

  try {
    const existing = await db
      .select({ batchId: batches.batchId })
      .from(batches)
      .where(eq(batches.batchId, batchId))
      .limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "batch already recorded off-chain" });
    }

    await db.transaction(async (tx) => {
      await tx.insert(batches).values({
        batchId,
        farmer: farmer.toLowerCase(),
        harvestDate: record.harvest_date,
        location: record.location,
        oliveType: record.olive_type,
        createTxHash: txHash,
      });

      await tx.insert(farmRecords).values({
        eventTxHash: txHash,
        batchId,
        quantity: record.quantity,
        cultivationMethod: record.cultivation_method,
        irrigationMethod: record.irrigation_method,
        fertilizerDetails: record.fertilizer_details,
        pesticideDetails: record.pesticide_details,
        harvestingMethod: record.harvesting_method,
        qualityDetails: record.quality_details,
        farmNotes: record.farm_notes,
      });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "db write failed" });
  }

  res.status(201).json({ batchId, txHash });
});

export default router;