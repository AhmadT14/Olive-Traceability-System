import { Router } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "../db/db.js";
import {
  millOliveRecords,
  millOilRecords,
  batches,
  transporterJobs,
} from "../db/schema.js";
import { hasRole, getBatch } from "../chain/reader.js";
import { getNextStageRole } from "../chain/checks.js";
import { requireAuth } from "../auth/middleware.js";
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

// Matches HASH_FIELDS.mill_oil exactly.
const millOutgoingSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a tx hash"),
  destinationAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address"),
  pressing_date: z.string().optional(), // YYYY-MM-DD
  extraction_method: z.string().optional(),
  output_quantity: z.union([z.string(), z.number()]).optional(),
  oil_quality: z.string().optional(),
  packaging_details: z.string().optional(),
  qr_code_reference: z.string().optional(),
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
      .select({ eventTxHash: millOliveRecords.eventTxHash })
      .from(millOliveRecords)
      .where(eq(millOliveRecords.eventTxHash, txHash))
      .limit(1);
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ error: "record already recorded off-chain" });
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

  const { txHash, destinationAddress, ...record } = parsed.data;

  let destinationRole;
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

    destinationRole = getNextStageRole(batch.stage);
    const destinationIsNextStage = await hasRole(
      destinationRole,
      destinationAddress,
    );
    if (!destinationIsNextStage) {
      return res.status(400).json({
        error: `destination must have ${destinationRole} role`,
      });
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
    // The mill can only list oil for pickup after it has recorded intake —
    // mirrors the on-chain requirement that postForPickup only runs on a
    // batch the caller already holds (status == Created, i.e. after its own
    // confirmReceipt). Off-chain, that means a mill_olive_records row must
    // already exist for this batch.
    const intakeExists = await db
      .select({ eventTxHash: millOliveRecords.eventTxHash })
      .from(millOliveRecords)
      .where(eq(millOliveRecords.batchId, batchId))
      .limit(1);
    if (intakeExists.length === 0) {
      return res.status(409).json({
        error: "no mill intake recorded off-chain for this batch yet",
      });
    }

    const existing = await db
      .select({ eventTxHash: millOilRecords.eventTxHash })
      .from(millOilRecords)
      .where(eq(millOilRecords.eventTxHash, txHash))
      .limit(1);
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ error: "record already recorded off-chain" });
    }

    const activeJob = await db
      .select({ id: transporterJobs.id })
      .from(transporterJobs)
      .where(
        and(
          eq(transporterJobs.batchId, batchId),
          eq(transporterJobs.status, "available"),
        ),
      )
      .limit(1);
    if (activeJob.length > 0) {
      return res.status(409).json({ error: "transporter job already exists for this batch" });
    }

    await db.transaction(async (tx) => {
      await tx.insert(millOilRecords).values({
        eventTxHash: txHash,
        batchId,
        pressingDate: record.pressing_date,
        extractionMethod: record.extraction_method,
        outputQuantity: record.output_quantity,
        oilQuality: record.oil_quality,
        packagingDetails: record.packaging_details,
        qrCodeReference: record.qr_code_reference,
        notes: record.notes,
      });

      await tx.insert(transporterJobs).values({
        batchId,
        sourceParty: req.user.address.toLowerCase(),
        destinationParty: destinationAddress.toLowerCase(),
        status: "available",
      });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "db write failed" });
  }

  res.status(201).json({
    batchId,
    txHash,
    sourceParty: req.user.address.toLowerCase(),
    destinationParty: destinationAddress.toLowerCase(),
    destinationRole,
  });
});

export default router;
