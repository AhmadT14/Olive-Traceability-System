import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/db.js";
import { batchEvents, batches, participants, transporterJobs } from "../db/schema.js";
import { decodeTx, getBatch, hasRole } from "../chain/reader.js";
import { requireAuth } from "../auth/middleware.js";
import {
  EventNotFoundError,
  HashMismatchError,
  verifyRecordAgainstChain,
} from "../hashing/verify.js";

const router = Router();

const storageOutgoingSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a tx hash"),
  quantity_released: z.union([z.string(), z.number()]).optional(),
  storage_end_date: z.string().optional(),
  product_condition: z.string().optional(),
  packaging_condition: z.string().optional(),
  loading_details: z.string().optional(),
  notes: z.string().optional(),
});

router.post("/batches/:id/storage-outgoing", requireAuth, async (req, res) => {
  const batchId = req.params.id.trim();
  if (!batchId || batchId.length > 64) return res.status(400).json({ error: "invalid batch id" });

  const parsed = storageOutgoingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  }
  const { txHash, ...record } = parsed.data;

  try {
    const [storage, batch] = await Promise.all([
      hasRole("STORAGE", req.user.address),
      getBatch(batchId),
    ]);
    if (!storage) return res.status(403).json({ error: "caller is not a storage facility" });
    if (batch.status === "None") return res.status(404).json({ error: "batch not found" });
    if (batch.stage !== "Storage" || batch.status !== "Listed") {
      return res.status(409).json({ error: "batch is not listed by a storage facility" });
    }
    if (batch.custodian.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: "caller is not current custodian" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }

  try {
    await verifyRecordAgainstChain("storage_outgoing", txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) return res.status(409).json({ error: "record does not match the on-chain hash" });
    if (err instanceof EventNotFoundError) {
      return res.status(404).json({ error: "tx not found or has no BatchListed event for this batch" });
    }
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }

  try {
    const decoded = await decodeTx(txHash);
    const listing = decoded?.events.find((event) =>
      event.name === "BatchListed" &&
      event.args.custodian?.toLowerCase() === req.user.address.toLowerCase(),
    );
    if (!listing) return res.status(409).json({ error: "listing event was not submitted by caller" });
    const destinationParty = listing.args.destinationAddress?.toLowerCase();
    if (!destinationParty) return res.status(409).json({ error: "listing event has no on-chain destination" });

    const [participant, intake, batchExists, existing] = await Promise.all([
      db.select({ walletAddress: participants.walletAddress }).from(participants)
        .where(eq(participants.walletAddress, destinationParty)).limit(1),
      db.select({ eventTxHash: batchEvents.eventTxHash }).from(batchEvents)
        .where(and(eq(batchEvents.batchId, batchId), eq(batchEvents.detailsType, "storage_intake"))).limit(1),
      db.select({ batchId: batches.batchId }).from(batches).where(eq(batches.batchId, batchId)).limit(1),
      db.select({ eventTxHash: batchEvents.eventTxHash }).from(batchEvents).where(eq(batchEvents.eventTxHash, txHash)).limit(1),
    ]);
    if (participant.length === 0) return res.status(409).json({ error: "on-chain destination is missing from the participant directory" });
    if (intake.length === 0) return res.status(409).json({ error: "no storage intake recorded off-chain for this batch yet" });
    if (batchExists.length === 0) return res.status(409).json({ error: "batch has no off-chain create record yet" });
    if (existing.length > 0) return res.status(409).json({ error: "record already recorded off-chain" });

    await db.transaction(async (tx) => {
      await tx.insert(batchEvents).values({
        eventTxHash: txHash,
        batchId,
        contractEvent: "BatchListed",
        detailsType: "storage_outgoing",
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
    if (err.code === "23505") return res.status(409).json({ error: "record already recorded off-chain" });
    console.error(err);
    return res.status(500).json({ error: "db write failed" });
  }

  return res.status(201).json({ batchId, txHash });
});

export default router;
