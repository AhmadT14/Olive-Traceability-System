import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { batchEvents, participants, transporterJobs } from "../db/schema.js";
import { hasRole, getBatch } from "../chain/reader.js";
import { batchCustody } from "../chain/contracts.js";
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
import { farmPreparationSchema } from "../validation/batch.schemas.js";
import {
  millListingSchema,
  storageListingSchema,
  exporterListingSchema,
  importerListingSchema,
} from "../validation/listing.schemas.js";
import {
  prepareOlivePickupSchema,
  prepareOilPickupSchema,
  prepareOliveDeliverySchema,
  prepareOilDeliverySchema,
} from "../validation/transporter.schemas.js";
import { receiptSchemas } from "../validation/receipt.schemas.js";
import { batchIdSchema } from "../validation/common.schemas.js";

const router = Router();

const prepareBatchSchema = farmPreparationSchema;
const prepareListingSchema = millListingSchema;
const prepareStorageListingSchema = storageListingSchema;
const prepareExporterListingSchema = exporterListingSchema;
const prepareImporterListingSchema = importerListingSchema;
const olivePickupSchema = prepareOlivePickupSchema;
const oilPickupSchema = prepareOilPickupSchema;
const oliveDeliverySchema = prepareOliveDeliverySchema;
const oilDeliverySchema = prepareOilDeliverySchema;

router.post("/batches/prepare", requireAuth, async (req, res) => {
  const parsed = prepareBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid payload", details: parsed.error.flatten() });
  }

  const { batchId, destinationAddress: rawDestinationAddress, ...record } = parsed.data;
  const destinationAddress = rawDestinationAddress.toLowerCase();

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

    const [destination, destinationHasRole] = await Promise.all([
      db
        .select({ walletAddress: participants.walletAddress })
        .from(participants)
        .where(eq(participants.walletAddress, destinationAddress))
        .limit(1),
      hasRole("MILL", destinationAddress),
    ]);
    if (destination.length === 0) {
      return res.status(400).json({ error: "destination must be a registered participant" });
    }
    if (!destinationHasRole) {
      return res.status(400).json({ error: "destination must have MILL role" });
    }

    const dataHash = computeRecordHash("farm", record);
    const data = batchCustody.interface.encodeFunctionData("createBatch", [
      batchId,
      destinationAddress,
      dataHash,
    ]);

    return res.json({
      batchId,
      destinationAddress,
      destinationRole: "MILL",
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

  const { batchId, destinationAddress: rawDestinationAddress, ...record } = parsed.data;
  const destinationAddress = rawDestinationAddress.toLowerCase();

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

    const nextRole = getNextStageRole(batch.stage);
    const [destination, destinationHasRole] = await Promise.all([
      db
        .select({ walletAddress: participants.walletAddress })
        .from(participants)
        .where(eq(participants.walletAddress, destinationAddress))
        .limit(1),
      hasRole(nextRole, destinationAddress),
    ]);
    if (destination.length === 0) {
      return res.status(400).json({ error: "destination must be a registered participant" });
    }
    if (!destinationHasRole) {
      return res.status(400).json({ error: `destination must have ${nextRole} role` });
    }

    const dataHash = computeRecordHash("mill_oil", record);
    const data = batchCustody.interface.encodeFunctionData("postForPickup", [
      batchId,
      destinationAddress,
      dataHash,
    ]);

    return res.json({
      batchId,
      destinationAddress,
      destinationRole: nextRole,
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

router.post("/batches/prepare-storage-listing", requireAuth, async (req, res) => {
  const parsed = prepareStorageListingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
  }

  const { batchId, destinationAddress: rawDestinationAddress, ...record } = parsed.data;
  const destinationAddress = rawDestinationAddress.toLowerCase();
  try {
    const [storage, batch] = await Promise.all([
      hasRole("STORAGE", req.user.address),
      getBatch(batchId),
    ]);
    if (!storage) return res.status(403).json({ error: "caller is not a storage facility" });
    if (batch.status === "None") return res.status(404).json({ error: "batch not found" });
    if (batch.stage !== "Storage") return res.status(409).json({ error: "batch is not at the storage stage" });

    const check = checkCanPostForPickup({ batch, actor: req.user.address });
    if (!check.allowed) return res.status(409).json({ error: check.reason });

    const intake = await db.select({ eventTxHash: batchEvents.eventTxHash })
      .from(batchEvents)
      .where(and(
        eq(batchEvents.batchId, batchId),
        eq(batchEvents.detailsType, "storage_intake"),
      )).limit(1);
    if (intake.length === 0) return res.status(409).json({ error: "no storage intake recorded off-chain for this batch yet" });

    const nextRole = getNextStageRole(batch.stage);
    const [destination, destinationHasRole] = await Promise.all([
      db.select({ walletAddress: participants.walletAddress }).from(participants)
        .where(eq(participants.walletAddress, destinationAddress)).limit(1),
      hasRole(nextRole, destinationAddress),
    ]);
    if (destination.length === 0) return res.status(400).json({ error: "destination must be a registered participant" });
    if (!destinationHasRole) return res.status(400).json({ error: `destination must have ${nextRole} role` });

    const dataHash = computeRecordHash("storage_outgoing", record);
    const data = batchCustody.interface.encodeFunctionData("postForPickup", [batchId, destinationAddress, dataHash]);
    return res.json({ batchId, destinationAddress, destinationRole: nextRole, dataHash,
      transaction: { to: config.BATCH_CUSTODY_ADDRESS, data, value: "0x0" } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "storage listing preparation failed" });
  }
});

function addStageListingRoute({ path, schema, role, stage, hashStage, intakeType }) {
  router.post(path, requireAuth, async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid payload", details: parsed.error.flatten() });
    }

    const { batchId, destinationAddress: rawDestinationAddress, ...record } = parsed.data;
    const destinationAddress = rawDestinationAddress.toLowerCase();

    try {
      const [participantRole, batch] = await Promise.all([
        hasRole(role, req.user.address),
        getBatch(batchId),
      ]);
      if (!participantRole) return res.status(403).json({ error: `caller is not an ${role.toLowerCase()}` });
      if (batch.status === "None") return res.status(404).json({ error: "batch not found" });
      if (batch.stage !== stage) return res.status(409).json({ error: `batch is not at the ${stage.toLowerCase()} stage` });

      const check = checkCanPostForPickup({ batch, actor: req.user.address });
      if (!check.allowed) return res.status(409).json({ error: check.reason });

      const intake = await db
        .select({ eventTxHash: batchEvents.eventTxHash })
        .from(batchEvents)
        .where(and(
          eq(batchEvents.batchId, batchId),
          eq(batchEvents.detailsType, intakeType),
        ))
        .limit(1);
      if (intake.length === 0) {
        return res.status(409).json({ error: `no ${stage.toLowerCase()} intake recorded off-chain for this batch yet` });
      }

      const nextRole = getNextStageRole(batch.stage);
      const [destination, destinationHasRole] = await Promise.all([
        db.select({ walletAddress: participants.walletAddress }).from(participants)
          .where(eq(participants.walletAddress, destinationAddress)).limit(1),
        hasRole(nextRole, destinationAddress),
      ]);
      if (destination.length === 0) return res.status(400).json({ error: "destination must be a registered participant" });
      if (!destinationHasRole) return res.status(400).json({ error: `destination must have ${nextRole} role` });

      const dataHash = computeRecordHash(hashStage, record);
      const data = batchCustody.interface.encodeFunctionData("postForPickup", [
        batchId,
        destinationAddress,
        dataHash,
      ]);
      return res.json({
        batchId,
        destinationAddress,
        destinationRole: nextRole,
        dataHash,
        transaction: { to: config.BATCH_CUSTODY_ADDRESS, data, value: "0x0" },
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "chain read failed" });
    }
  });
}

addStageListingRoute({
  path: "/batches/prepare-exporter-listing",
  schema: prepareExporterListingSchema,
  role: "EXPORTER",
  stage: "Exporter",
  hashStage: "exporter_outgoing",
  intakeType: "exporter_intake",
});

addStageListingRoute({
  path: "/batches/prepare-importer-listing",
  schema: prepareImporterListingSchema,
  role: "IMPORTER",
  stage: "Importer",
  hashStage: "importer_outgoing",
  intakeType: "importer_intake",
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
      batchId: batchIdSchema,
    }).safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "invalid payload", details: parsed.error.flatten() });
    }
    const { batchId: _batchId, ...record } = parsed.data;
    const dataHash = computeRecordHash(receipt.hashStage, record);
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
