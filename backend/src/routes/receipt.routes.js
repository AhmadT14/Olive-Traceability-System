import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/db.js";
import { batchEvents, transporterJobs } from "../db/schema.js";
import { decodeTx, getBatch, hasRole } from "../chain/reader.js";
import { requireAuth } from "../auth/middleware.js";
import {
  verifyRecordAgainstChain,
  HashMismatchError,
  EventNotFoundError,
} from "../hashing/verify.js";

const router = Router();

const receiptDefinitions = {
  Storage: {
    role: "STORAGE",
    hashStage: "storage",
    detailsType: "storage_intake",
    schema: z.object({
      quantity_received: z.union([z.string(), z.number()]).optional(),
      storage_start_date: z.string().optional(),
      expected_duration: z.number().int().optional(),
      conditions: z.string().optional(),
      product_condition: z.string().optional(),
      notes: z.string().optional(),
    }),
  },
  Importer: {
    role: "IMPORTER",
    hashStage: "import",
    detailsType: "importer_intake",
    schema: z.object({
      quantity_received: z.union([z.string(), z.number()]).optional(),
      shipment_arrival_details: z.string().optional(),
      received_product_details: z.string().optional(),
      product_condition: z.string().optional(),
      notes: z.string().optional(),
    }),
  },
  Retailer: {
    role: "RETAILER",
    hashStage: "retail",
    detailsType: "retailer_intake",
    schema: z.object({
      quantity_received: z.union([z.string(), z.number()]).optional(),
      final_receipt_details: z.string().optional(),
      product_condition: z.string().optional(),
      notes: z.string().optional(),
    }),
  },
};

router.post("/batches/:id/receipt", requireAuth, async (req, res) => {
  const batchId = req.params.id.trim();
  if (!batchId || batchId.length > 64) {
    return res.status(400).json({ error: "invalid batch id" });
  }

  const txHash = req.body?.txHash;
  if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return res.status(400).json({ error: "invalid tx hash" });
  }

  let definition;
  try {
    const batch = await getBatch(batchId);
    if (batch.status === "None") {
      return res.status(404).json({ error: "batch not found" });
    }
    definition = receiptDefinitions[batch.stage];
    if (!definition) {
      return res.status(409).json({
        error: `receipt persistence is not defined for stage ${batch.stage}`,
      });
    }
    if (batch.status !== "Created" || batch.custodian.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(409).json({ error: "caller is not the confirmed receipt custodian" });
    }
    if (!(await hasRole(definition.role, req.user.address))) {
      return res.status(403).json({ error: `caller is not a ${definition.role.toLowerCase()}` });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }

  const parsed = definition.schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid payload", details: parsed.error.flatten() });
  }
  const record = parsed.data;

  try {
    await verifyRecordAgainstChain(definition.hashStage, txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) {
      return res.status(409).json({ error: "record does not match the on-chain hash" });
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
        detailsType: definition.detailsType,
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
    if (err.code === "23505") {
      return res.status(409).json({ error: "event details already recorded" });
    }
    console.error(err);
    return res.status(500).json({ error: "db write failed" });
  }

  return res.status(201).json({ batchId, txHash, stage: definition.hashStage });
});

export default router;
