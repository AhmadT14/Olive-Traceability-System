import { Router } from "express";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { transporterJobs } from "../db/schema.js";
import { batchCustody, hasRole, getBatch } from "../chain/reader.js";
import { config } from "../config.js";
import {
  checkCanCreateBatch,
  checkCanPostForPickup,
  checkCanClaimBatch,
  checkCanInitiateHandover,
  checkCanConfirmReceipt,
  getNextStageRole,
} from "../chain/checks.js";
import { computeRecordHash } from "../hashing/canonical.js";
import { requireAuth } from "../auth/middleware.js";

const router = Router();

const prepareBatchSchema = z.object({
  batchId: z.string().trim().min(1).max(64),
  harvest_date: z.string().min(1),
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

const prepareListingSchema = z.object({
  batchId: z.string().trim().min(1).max(64),
  pressing_date: z.string().optional(),
  extraction_method: z.string().optional(),
  output_quantity: z.union([z.string(), z.number()]).optional(),
  oil_quality: z.string().optional(),
  packaging_details: z.string().optional(),
  qr_code_reference: z.string().optional(),
  notes: z.string().optional(),
});

const pickupFields = {
  truck_details: z.string().optional(),
  quantity_picked_up: z.union([z.string(), z.number()]).optional(),
  loading_details: z.string().optional(),
  transport_conditions: z.string().optional(),
  notes: z.string().optional(),
};
const olivePickupSchema = z.object({
  batchId: z.string().trim().min(1).max(64),
  ...pickupFields,
  pickup_condition: z.string().optional(),
  olive_condition: z.string().optional(),
});
const oilPickupSchema = z.object({
  batchId: z.string().trim().min(1).max(64),
  ...pickupFields,
  oil_condition: z.string().optional(),
  packaging_condition: z.string().optional(),
});

const deliveryFields = {
  quantity_delivered: z.union([z.string(), z.number()]).optional(),
  unloading_details: z.string().optional(),
  transport_conditions: z.string().optional(),
  notes: z.string().optional(),
};
const oliveDeliverySchema = z.object({
  batchId: z.string().trim().min(1).max(64),
  targetAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address"),
  ...deliveryFields,
  olive_condition: z.string().optional(),
});
const oilDeliverySchema = z.object({
  batchId: z.string().trim().min(1).max(64),
  targetAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address"),
  ...deliveryFields,
  oil_condition: z.string().optional(),
  packaging_condition: z.string().optional(),
});

const receiptSchemas = {
  Farm: {
    key: "mill_olive",
    schema: z.object({
      arrival_condition: z.string().optional(),
      quantity_received: z.union([z.string(), z.number()]).optional(),
      olive_quality: z.string().optional(),
      storage_condition: z.string().optional(),
      notes: z.string().optional(),
    }),
  },
  Mill: {
    key: "storage",
    schema: z.object({
      quantity_received: z.union([z.string(), z.number()]).optional(),
      storage_start_date: z.string().optional(),
      expected_duration: z.number().int().optional(),
      conditions: z.string().optional(),
      product_condition: z.string().optional(),
      notes: z.string().optional(),
    }),
  },
  Exporter: {
    key: "import",
    schema: z.object({
      quantity_received: z.union([z.string(), z.number()]).optional(),
      shipment_arrival_details: z.string().optional(),
      received_product_details: z.string().optional(),
      product_condition: z.string().optional(),
      notes: z.string().optional(),
    }),
  },
  Importer: {
    key: "retail",
    schema: z.object({
      quantity_received: z.union([z.string(), z.number()]).optional(),
      final_receipt_details: z.string().optional(),
      product_condition: z.string().optional(),
      notes: z.string().optional(),
    }),
  },
};

router.post("/batches/prepare", requireAuth, async (req, res) => {
  const parsed = prepareBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid payload", details: parsed.error.flatten() });
  }

  const { batchId, ...record } = parsed.data;

  try {
    const farmer = await hasRole("FARMER", req.user.address);
    const existingBatch = await getBatch(batchId);
    const check = checkCanCreateBatch({
      role: farmer ? "FARMER" : null,
      batchExists: existingBatch.status !== "None",
    });

    if (!check.allowed) {
      const status = farmer ? 409 : 403;
      return res.status(status).json({ error: check.reason });
    }

    const dataHash = computeRecordHash("farm", record);
    const data = batchCustody.interface.encodeFunctionData("createBatch", [
      batchId,
      dataHash,
    ]);

    return res.json({
      batchId,
      dataHash,
      transaction: {
        to: config.BATCH_CUSTODY_ADDRESS,
        data,
        value: "0x0",
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }
});

router.post("/batches/prepare-listing", requireAuth, async (req, res) => {
  const parsed = prepareListingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid payload", details: parsed.error.flatten() });
  }

  const { batchId, ...record } = parsed.data;

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
    if (batch.stage !== "Mill") {
      return res.status(409).json({ error: "batch is not at the mill stage" });
    }

    const check = checkCanPostForPickup({ batch, actor: req.user.address });
    if (!check.allowed) {
      return res.status(409).json({ error: check.reason });
    }

    const dataHash = computeRecordHash("mill_oil", record);
    const data = batchCustody.interface.encodeFunctionData("postForPickup", [
      batchId,
      dataHash,
    ]);

    return res.json({
      batchId,
      dataHash,
      transaction: {
        to: config.BATCH_CUSTODY_ADDRESS,
        data,
        value: "0x0",
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }
});

router.post("/batches/prepare-claim", requireAuth, async (req, res) => {
  const batchId = typeof req.body?.batchId === "string" ? req.body.batchId.trim() : "";
  if (!batchId || batchId.length > 64) {
    return res.status(400).json({ error: "invalid batch id" });
  }

  try {
    const [transporter, batch] = await Promise.all([
      hasRole("TRANSPORTER", req.user.address),
      getBatch(batchId),
    ]);
    if (!transporter) {
      return res.status(403).json({ error: "caller is not a transporter" });
    }
    if (batch.status === "None") {
      return res.status(404).json({ error: "batch not found" });
    }

    const check = checkCanClaimBatch({ batch, role: "TRANSPORTER" });
    if (!check.allowed) {
      return res.status(409).json({ error: check.reason });
    }

    const availableJob = await db
      .select({ id: transporterJobs.id })
      .from(transporterJobs)
      .where(
        and(
          eq(transporterJobs.batchId, batchId),
          eq(transporterJobs.status, "available"),
        ),
      )
      .limit(1);
    if (availableJob.length === 0) {
      return res.status(409).json({ error: "no available transporter job for this batch" });
    }

    const productType = batch.stage === "Farm" ? "olive" : "oil";
    const parsed = (productType === "olive" ? olivePickupSchema : oilPickupSchema).safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid payload", details: parsed.error.flatten() });
    }

    const { batchId: _batchId, ...record } = parsed.data;
    const stageKey = `transporter_${productType}`;
    const dataHash = computeRecordHash(stageKey, record);
    const data = batchCustody.interface.encodeFunctionData("claimBatch", [
      batchId,
      dataHash,
    ]);

    return res.json({
      batchId,
      productType,
      dataHash,
      transaction: {
        to: config.BATCH_CUSTODY_ADDRESS,
        data,
        value: "0x0",
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "chain read failed" });
  }
});

router.post("/batches/prepare-handover", requireAuth, async (req, res) => {
  const batchId = typeof req.body?.batchId === "string" ? req.body.batchId.trim() : "";
  if (!batchId || batchId.length > 64) {
    return res.status(400).json({ error: "invalid batch id" });
  }

  try {
    const [transporter, batch] = await Promise.all([
      hasRole("TRANSPORTER", req.user.address),
      getBatch(batchId),
    ]);
    if (!transporter) {
      return res.status(403).json({ error: "caller is not a transporter" });
    }
    if (batch.status === "None") {
      return res.status(404).json({ error: "batch not found" });
    }

    const expectedRole = getNextStageRole(batch.stage);
    const check = checkCanInitiateHandover({
      batch,
      actor: req.user.address,
      role: "TRANSPORTER",
      targetRole: expectedRole,
    });
    if (!check.allowed) {
      return res.status(409).json({ error: check.reason });
    }

    const parsed = (batch.stage === "Farm" ? oliveDeliverySchema : oilDeliverySchema)
      .safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid payload", details: parsed.error.flatten() });
    }
    const { targetAddress, batchId: _batchId, ...record } = parsed.data;

    const [job, targetHasNextRole] = await Promise.all([
      db
        .select({ destinationParty: transporterJobs.destinationParty })
        .from(transporterJobs)
        .where(
          and(
            eq(transporterJobs.batchId, batchId),
            eq(transporterJobs.transporter, req.user.address.toLowerCase()),
            eq(transporterJobs.status, "claimed"),
          ),
        )
        .orderBy(desc(transporterJobs.createdAt))
        .limit(1),
      hasRole(expectedRole, targetAddress),
    ]);
    if (job.length === 0) {
      return res.status(409).json({ error: "transporter has no claimed job for this batch" });
    }
    if (job[0].destinationParty.toLowerCase() !== targetAddress.toLowerCase()) {
      return res.status(400).json({ error: "target must match the destination selected for this job" });
    }
    if (!targetHasNextRole) {
      return res.status(400).json({ error: `target must have ${expectedRole} role` });
    }

    const productType = batch.stage === "Farm" ? "olive" : "oil";
    const stageKey = `transporter_${productType}_outgoing`;
    const dataHash = computeRecordHash(stageKey, record);
    const data = batchCustody.interface.encodeFunctionData("initiateHandover", [
      batchId,
      targetAddress,
      dataHash,
    ]);

    return res.json({
      batchId,
      targetAddress,
      productType,
      dataHash,
      transaction: {
        to: config.BATCH_CUSTODY_ADDRESS,
        data,
        value: "0x0",
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "handover preparation failed" });
  }
});

router.post("/batches/prepare-receipt", requireAuth, async (req, res) => {
  const batchId = typeof req.body?.batchId === "string" ? req.body.batchId.trim() : "";
  if (!batchId || batchId.length > 64) {
    return res.status(400).json({ error: "invalid batch id" });
  }

  try {
    const batch = await getBatch(batchId);
    if (batch.status === "None") {
      return res.status(404).json({ error: "batch not found" });
    }

    const receipt = receiptSchemas[batch.stage];
    if (!receipt) {
      return res.status(409).json({
        error: `receipt schema is not defined for stage ${batch.stage}`,
      });
    }

    const expectedRole = getNextStageRole(batch.stage);
    if (!expectedRole) {
      return res.status(409).json({ error: "batch is already at final stage" });
    }
    const roleValid = await hasRole(expectedRole, req.user.address);
    if (!roleValid) {
      return res.status(403).json({ error: `caller is not a ${expectedRole.toLowerCase()}` });
    }

    const check = checkCanConfirmReceipt({ batch, actor: req.user.address });
    if (!check.allowed) {
      return res.status(409).json({ error: check.reason });
    }

    const parsed = receipt.schema.extend({
      batchId: z.string().trim().min(1).max(64),
    }).safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid payload", details: parsed.error.flatten() });
    }
    const { batchId: _batchId, ...record } = parsed.data;
    const dataHash = computeRecordHash(receipt.key, record);
    const data = batchCustody.interface.encodeFunctionData("confirmReceipt", [
      batchId,
      dataHash,
    ]);

    return res.json({
      batchId,
      dataHash,
      transaction: {
        to: config.BATCH_CUSTODY_ADDRESS,
        data,
        value: "0x0",
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "receipt preparation failed" });
  }
});

export default router;
