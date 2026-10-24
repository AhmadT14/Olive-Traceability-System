import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { batchEvents, batches, participants, transporterJobs } from "../db/schema.js";
import { decodeTx, hasRole } from "../chain/reader.js";
import { requireAuth } from "../auth/middleware.js";
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

router.post("/batches", requireAuth, async (req, res) => {
  const parsed = createBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid payload", details: parsed.error.flatten() });
  }

  const { txHash, batchId, ...record } = parsed.data;
  let destinationParty;

  try {
    if (!(await hasRole("FARMER", req.user.address))) {
      return res.status(403).json({ error: "caller is not a farmer" });
    }

    const decoded = await decodeTx(txHash);
    const creation = decoded?.events.find((event) => event.name === "BatchCreated");
    if (!decoded?.success || !creation) {
      return res.status(404).json({ error: "tx not found or has no successful BatchCreated event" });
    }
    if (creation.args.farmer?.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: "batch transaction was not submitted by caller" });
    }
    destinationParty = creation.args.destinationAddress?.toLowerCase();
    if (!destinationParty) {
      return res.status(409).json({ error: "batch event has no on-chain destination" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }

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
    const destination = await db
      .select({ walletAddress: participants.walletAddress })
      .from(participants)
      .where(eq(participants.walletAddress, destinationParty))
      .limit(1);
    if (destination.length === 0) {
      return res.status(409).json({ error: "on-chain destination is missing from the participant directory" });
    }

    const existing = await db
      .select({ batchId: batches.batchId })
      .from(batches)
      .where(eq(batches.batchId, batchId))
      .limit(1);
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ error: "batch already recorded off-chain" });
    }

    await db.transaction(async (tx) => {
      await tx.insert(batches).values({ batchId });
      await tx.insert(batchEvents).values({
        eventTxHash: txHash,
        batchId,
        contractEvent: "BatchCreated",
        detailsType: "farm",
        payloadVersion: 1,
        details: record,
      });
      await tx.insert(transporterJobs).values({
        batchId,
        sourceParty: req.user.address.toLowerCase(),
        destinationParty,
        status: "available",
        listingTxHash: txHash,
      });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "db write failed" });
  }

  res.status(201).json({ batchId, txHash });
});

export default router;
