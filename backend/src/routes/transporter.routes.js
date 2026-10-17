import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/db.js";
import {
  transporterJobs,
  transporterOliveRecords,
  transporterOilRecords,
} from "../db/schema.js";
import { decodeTx, getBatch, hasRole } from "../chain/reader.js";
import { requireAuth } from "../auth/middleware.js";
import {
  verifyRecordAgainstChain,
  HashMismatchError,
  EventNotFoundError,
} from "../hashing/verify.js";

const router = Router();

const pickupFields = {
  truck_details: z.string().optional(),
  quantity_picked_up: z.union([z.string(), z.number()]).optional(),
  loading_details: z.string().optional(),
  transport_conditions: z.string().optional(),
  notes: z.string().optional(),
};
const oliveRecordSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a tx hash"),
  ...pickupFields,
  pickup_condition: z.string().optional(),
  olive_condition: z.string().optional(),
});
const oilRecordSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a tx hash"),
  ...pickupFields,
  oil_condition: z.string().optional(),
  packaging_condition: z.string().optional(),
});
const deliveryFields = {
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a tx hash"),
  quantity_delivered: z.union([z.string(), z.number()]).optional(),
  unloading_details: z.string().optional(),
  transport_conditions: z.string().optional(),
  notes: z.string().optional(),
};
const oliveDeliverySchema = z.object({
  ...deliveryFields,
  olive_condition: z.string().optional(),
});
const oilDeliverySchema = z.object({
  ...deliveryFields,
  oil_condition: z.string().optional(),
  packaging_condition: z.string().optional(),
});

router.post("/batches/:id/transporter-claim", requireAuth, async (req, res) => {
  const batchId = req.params.id.trim();
  if (!batchId || batchId.length > 64) {
    return res.status(400).json({ error: "invalid batch id" });
  }

  let batch;
  let productType;
  try {
    const [transporter, currentBatch] = await Promise.all([
      hasRole("TRANSPORTER", req.user.address),
      getBatch(batchId),
    ]);
    if (!transporter) {
      return res.status(403).json({ error: "caller is not a transporter" });
    }
    if (currentBatch.status === "None") {
      return res.status(404).json({ error: "batch not found" });
    }
    if (
      currentBatch.status !== "Created" ||
      currentBatch.custodian.toLowerCase() !== req.user.address.toLowerCase()
    ) {
      return res.status(409).json({ error: "transporter does not hold this claimed batch" });
    }
    batch = currentBatch;
    productType = batch.stage === "Farm" ? "olive" : "oil";
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }

  const schema = productType === "olive" ? oliveRecordSchema : oilRecordSchema;
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid payload", details: parsed.error.flatten() });
  }
  const { txHash, ...record } = parsed.data;
  const hashStage = `transporter_${productType}`;

  try {
    await verifyRecordAgainstChain(hashStage, txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) {
      return res.status(409).json({ error: "record does not match the on-chain hash" });
    }
    if (err instanceof EventNotFoundError) {
      return res.status(404).json({
        error: "tx not found or has no BatchClaimed event for this batch",
      });
    }
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }

  try {
    const decoded = await decodeTx(txHash);
    const claim = decoded?.events.find(
      (event) =>
        event.name === "BatchClaimed" &&
        event.args.transporter?.toLowerCase() === req.user.address.toLowerCase(),
    );
    if (!claim) {
      return res.status(409).json({ error: "claim event was not submitted by caller" });
    }

    const jobs = await db
      .select({ id: transporterJobs.id })
      .from(transporterJobs)
      .where(
        and(
          eq(transporterJobs.batchId, batchId),
          eq(transporterJobs.status, "available"),
        ),
      )
      .limit(1);
    if (jobs.length === 0) {
      return res.status(409).json({ error: "no available transporter job for this batch" });
    }

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(transporterJobs)
        .set({ transporter: req.user.address.toLowerCase(), status: "claimed" })
        .where(
          and(
            eq(transporterJobs.id, jobs[0].id),
            eq(transporterJobs.status, "available"),
          ),
        )
        .returning({ id: transporterJobs.id });
      if (updated.length === 0) {
        throw new Error("job already claimed");
      }

      const table = productType === "olive" ? transporterOliveRecords : transporterOilRecords;
      const values = {
        eventTxHash: txHash,
        batchId,
        truckDetails: record.truck_details,
        quantityPickedUp: record.quantity_picked_up,
        loadingDetails: record.loading_details,
        transportConditions: record.transport_conditions,
        notes: record.notes,
      };
      if (productType === "olive") {
        values.pickupCondition = record.pickup_condition;
        values.oliveCondition = record.olive_condition;
      } else {
        values.oilCondition = record.oil_condition;
        values.packagingCondition = record.packaging_condition;
      }
      await tx.insert(table).values(values);
    });
  } catch (err) {
    if (err.message === "job already claimed") {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "db write failed" });
  }

  return res.status(201).json({
    batchId,
    txHash,
    transporter: req.user.address.toLowerCase(),
    productType,
  });
});

router.post("/batches/:id/transporter-handover", requireAuth, async (req, res) => {
  const batchId = req.params.id.trim();
  if (!batchId || batchId.length > 64) {
    return res.status(400).json({ error: "invalid batch id" });
  }

  let batch;
  let productType;
  try {
    const [transporter, currentBatch] = await Promise.all([
      hasRole("TRANSPORTER", req.user.address),
      getBatch(batchId),
    ]);
    if (!transporter) {
      return res.status(403).json({ error: "caller is not a transporter" });
    }
    if (currentBatch.status === "None") {
      return res.status(404).json({ error: "batch not found" });
    }
    if (
      currentBatch.status !== "PendingHandover" ||
      currentBatch.custodian.toLowerCase() !== req.user.address.toLowerCase()
    ) {
      return res.status(409).json({ error: "no pending handover from this transporter" });
    }
    batch = currentBatch;
    productType = batch.stage === "Farm" ? "olive" : "oil";
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }

  const parsed = (productType === "olive" ? oliveDeliverySchema : oilDeliverySchema)
    .safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid payload", details: parsed.error.flatten() });
  }
  const { txHash, ...record } = parsed.data;
  const hashStage = `transporter_${productType}_outgoing`;

  try {
    await verifyRecordAgainstChain(hashStage, txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) {
      return res.status(409).json({ error: "record does not match the on-chain hash" });
    }
    if (err instanceof EventNotFoundError) {
      return res.status(404).json({
        error: "tx not found or has no HandoverInitiated event for this batch",
      });
    }
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }

  try {
    const decoded = await decodeTx(txHash);
    const handover = decoded?.events.find(
      (event) =>
        event.name === "HandoverInitiated" &&
        event.args.currentCustodian?.toLowerCase() === req.user.address.toLowerCase() &&
        event.args.targetAddress?.toLowerCase() === batch.pendingTarget.toLowerCase(),
    );
    if (!handover) {
      return res.status(409).json({ error: "handover event does not match caller and pending target" });
    }

    const job = await db
      .select({ id: transporterJobs.id })
      .from(transporterJobs)
      .where(
        and(
          eq(transporterJobs.batchId, batchId),
          eq(transporterJobs.transporter, req.user.address.toLowerCase()),
          eq(transporterJobs.destinationParty, batch.pendingTarget.toLowerCase()),
          eq(transporterJobs.status, "claimed"),
        ),
      )
      .orderBy(desc(transporterJobs.createdAt))
      .limit(1);
    if (job.length === 0) {
      return res.status(409).json({ error: "no matching claimed job for this handover" });
    }

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(transporterJobs)
        .set({ status: "handover_pending" })
        .where(
          and(
            eq(transporterJobs.id, job[0].id),
            eq(transporterJobs.status, "claimed"),
          ),
        )
        .returning({ id: transporterJobs.id });
      if (updated.length === 0) throw new Error("job state changed");

      const table = productType === "olive" ? transporterOliveRecords : transporterOilRecords;
      const values = {
        eventTxHash: txHash,
        batchId,
        quantityDelivered: record.quantity_delivered,
        unloadingDetails: record.unloading_details,
        transportConditions: record.transport_conditions,
        notes: record.notes,
      };
      if (productType === "olive") values.oliveCondition = record.olive_condition;
      else {
        values.oilCondition = record.oil_condition;
        values.packagingCondition = record.packaging_condition;
      }
      await tx.insert(table).values(values);
    });
  } catch (err) {
    if (err.message === "job state changed") {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: "db write failed" });
  }

  return res.status(201).json({
    batchId,
    txHash,
    targetAddress: batch.pendingTarget,
    productType,
  });
});

export default router;
