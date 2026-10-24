import { Router } from "express";
import { millListingSchema } from "../validation/listing.schemas.js";
import { millReceiptSchema } from "../validation/receipt.schemas.js";
import { txHashSchema } from "../validation/common.schemas.js";
import { and, eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { batchEvents, batches, participants, transporterJobs } from "../db/schema.js";
import { decodeTx, hasRole, getBatch } from "../chain/reader.js";
import { requireAuth } from "../auth/middleware.js";
import {
  verifyRecordAgainstChain,
  HashMismatchError,
  EventNotFoundError,
} from "../hashing/verify.js";

const router = Router();

// Matches HASH_FIELDS.mill_olive exactly — see the note in batches.routes.js
// on why these stay snake_case rather than the Drizzle camelCase names.
const millIntakeSchema = millReceiptSchema.extend({ txHash: txHashSchema });

// Matches HASH_FIELDS.mill_oil exactly.
const millOutgoingSchema = millListingSchema.omit({ batchId: true, destinationAddress: true }).extend({ txHash: txHashSchema });

router.post("/batches/:id/mill-intake", requireAuth, async (req, res) => {
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
    const [mill, batch] = await Promise.all([
      hasRole("MILL", req.user.address),
      getBatch(batchId),
    ]);
    if (!mill) {
      return res.status(403).json({ error: "caller is not a mill" });
    }
    if (batch.status === "None") {
      return res.status(404).json({ error: "batch not found" });
    }
    if (
      batch.status !== "Created" ||
      batch.stage !== "Mill" ||
      batch.custodian.toLowerCase() !== req.user.address.toLowerCase()
    ) {
      return res.status(409).json({ error: "caller is not the confirmed receipt custodian" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }

  try {
    await verifyRecordAgainstChain("mill_olive", txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) {
      return res
        .status(409)
        .json({ error: "record does not match the on-chain hash" });
    }
    if (err instanceof EventNotFoundError) {
      return res.status(404).json({
        error: "tx not found or has no ReceiptConfirmed event for this batch",
      });
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
      .select({ eventTxHash: batchEvents.eventTxHash })
      .from(batchEvents)
      .where(eq(batchEvents.eventTxHash, txHash))
      .limit(1);
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ error: "record already recorded off-chain" });
    }

    const decoded = await decodeTx(txHash);
    const receipt = decoded?.events.find(
      (event) =>
        event.name === "ReceiptConfirmed" &&
        event.args.newCustodian?.toLowerCase() === req.user.address.toLowerCase(),
    );
    if (!receipt) {
      return res.status(409).json({ error: "receipt event was not submitted by caller" });
    }

    const jobs = await db
      .select({ id: transporterJobs.id })
      .from(transporterJobs)
      .where(
        and(
          eq(transporterJobs.batchId, batchId),
          eq(transporterJobs.destinationParty, req.user.address.toLowerCase()),
          eq(transporterJobs.status, "handover_pending"),
        ),
      )
      .limit(1);
    if (jobs.length === 0) {
      return res.status(409).json({ error: "no transporter handover is pending for this batch" });
    }

    await db.transaction(async (tx) => {
      await tx.insert(batchEvents).values({
        eventTxHash: txHash,
        batchId,
        contractEvent: "ReceiptConfirmed",
        detailsType: "mill_intake",
        payloadVersion: 1,
        details: record,
      });

      const updated = await tx
        .update(transporterJobs)
        .set({ status: "completed", receiptTxHash: txHash })
        .where(
          and(
            eq(transporterJobs.id, jobs[0].id),
            eq(transporterJobs.status, "handover_pending"),
          ),
        )
        .returning({ id: transporterJobs.id });
      if (updated.length === 0) throw new Error("job state changed");

    });
  } catch (err) {
    if (err.message === "job state changed") {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "db write failed" });
  }

  res.status(201).json({ batchId, txHash });
});

router.post("/batches/:id/mill-outgoing", requireAuth, async (req, res) => {
  const batchId = req.params.id.trim();
  if (!batchId || batchId.length > 64) {
    return res.status(400).json({ error: "invalid batch id" });
  }

  const parsed = millOutgoingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid payload", details: parsed.error.flatten() });
  }

  const { txHash, ...record } = parsed.data;

  try {
    const [mill, batch] = await Promise.all([
      hasRole("MILL", req.user.address),
      getBatch(batchId),
    ]);
    if (!mill) {
      return res.status(403).json({ error: "caller is not a mill" });
    }
    if (batch.status === "None") {
      return res.status(404).json({ error: "batch not found" });
    }
    if (batch.stage !== "Mill" || batch.status !== "Listed") {
      return res.status(409).json({ error: "batch is not listed by a mill" });
    }
    if (batch.custodian.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: "caller is not current custodian" });
    }

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }

  try {
    await verifyRecordAgainstChain("mill_oil", txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) {
      return res
        .status(409)
        .json({ error: "record does not match the on-chain hash" });
    }
    if (err instanceof EventNotFoundError) {
      return res.status(404).json({
        error: "tx not found or has no BatchListed event for this batch",
      });
    }
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }

  try {
    const decoded = await decodeTx(txHash);
    const listing = decoded?.events.find(
      (event) =>
        event.name === "BatchListed" &&
        event.args.custodian?.toLowerCase() === req.user.address.toLowerCase(),
    );
    if (!listing) {
      return res.status(409).json({ error: "listing event was not submitted by caller" });
    }
    const destinationParty = listing.args.destinationAddress?.toLowerCase();
    if (!destinationParty) {
      return res.status(409).json({ error: "listing event has no on-chain destination" });
    }

    // The destination must be represented in the participant directory before
    // the database can create its transporter job (the contract already
    // enforces the destination's next-stage role).
    const participant = await db
      .select({ walletAddress: participants.walletAddress })
      .from(participants)
      .where(eq(participants.walletAddress, destinationParty))
      .limit(1);
    if (participant.length === 0) {
      return res.status(409).json({ error: "on-chain destination is missing from the participant directory" });
    }

    // The mill can only list oil for pickup after it has recorded intake —
    // mirrors the on-chain requirement that postForPickup only runs on a
    // batch the caller already holds (status == Created, i.e. after its own
    // confirmReceipt). Off-chain, that means a mill_intake event row must
    // already exist for this batch.
    const intakeExists = await db
      .select({ eventTxHash: batchEvents.eventTxHash })
      .from(batchEvents)
      .where(
        and(
          eq(batchEvents.batchId, batchId),
          eq(batchEvents.detailsType, "mill_intake"),
        ),
      )
      .limit(1);
    if (intakeExists.length === 0) {
      return res.status(409).json({
        error: "no mill intake recorded off-chain for this batch yet",
      });
    }

    const existing = await db
      .select({ eventTxHash: batchEvents.eventTxHash })
      .from(batchEvents)
      .where(eq(batchEvents.eventTxHash, txHash))
      .limit(1);
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ error: "record already recorded off-chain" });
    }

    await db.transaction(async (tx) => {
      await tx.insert(batchEvents).values({
        eventTxHash: txHash,
        batchId,
        contractEvent: "BatchListed",
        detailsType: "mill_outgoing",
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
    if (err.code === "23505") {
      return res.status(409).json({ error: "record already recorded off-chain" });
    }
    console.error(err);
    return res.status(500).json({ error: "db write failed" });
  }

  res.status(201).json({ batchId, txHash });
});

export default router;
