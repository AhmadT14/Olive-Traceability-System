import { batchCustody } from "../chain/contracts.js";
import {
  checkCanClaimBatch,
  checkCanConfirmReceipt,
  checkCanCreateBatch,
  checkCanInitiateHandover,
  checkCanPostForPickup,
  getNextStageRole,
  getStageAfter,
  isAvailable,
} from "../chain/checks.js";
import { getBatch, hasRole } from "../chain/reader.js";
import { config } from "../config.js";
import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  internalError,
  notFound,
} from "../errors.js";
import { computeRecordHash } from "../hashing/canonical.js";
import * as batchEventRepository from "../repositories/batchEvent.repository.js";
import * as participantRepository from "../repositories/participant.repository.js";
import * as transporterJobRepository from "../repositories/transporterJob.repository.js";
import { farmPreparationSchema } from "../validation/batch.schemas.js";
import { batchIdSchema } from "../validation/common.schemas.js";
import {
  exporterListingSchema,
  importerListingSchema,
  millListingSchema,
  storageListingSchema,
} from "../validation/listing.schemas.js";
import { parseBatchIdFromBody, parseBody } from "../validation/parse.js";
import { receiptSchemas } from "../validation/receipt.schemas.js";
import {
  prepareOilDeliverySchema,
  prepareOilPickupSchema,
  prepareOliveDeliverySchema,
  prepareOlivePickupSchema,
} from "../validation/transporter.schemas.js";

const LISTINGS = {
  mill: {
    schema: millListingSchema,
    role: "MILL",
    roleError: "caller is not a mill",
    stage: "Mill",
    stageError: "batch is not at the mill stage",
    hashStage: "mill_oil",
    intakeType: null,
    intakeError: null,
    failureMessage: "chain read failed",
  },
  storage: {
    schema: storageListingSchema,
    role: "STORAGE",
    roleError: "caller is not a storage facility",
    stage: "Storage",
    stageError: "batch is not at the storage stage",
    hashStage: "storage_outgoing",
    intakeType: "storage_intake",
    intakeError: "no storage intake recorded off-chain for this batch yet",
    failureMessage: "storage listing preparation failed",
  },
  exporter: {
    schema: exporterListingSchema,
    role: "EXPORTER",
    roleError: "caller is not an exporter",
    stage: "Exporter",
    stageError: "batch is not at the exporter stage",
    hashStage: "exporter_outgoing",
    intakeType: "exporter_intake",
    intakeError: "no exporter intake recorded off-chain for this batch yet",
    failureMessage: "chain read failed",
  },
  importer: {
    schema: importerListingSchema,
    role: "IMPORTER",
    roleError: "caller is not an importer",
    stage: "Importer",
    stageError: "batch is not at the importer stage",
    hashStage: "importer_outgoing",
    intakeType: "importer_intake",
    intakeError: "no importer intake recorded off-chain for this batch yet",
    failureMessage: "chain read failed",
  },
};

export async function prepareBatch(user, body) {
  const {
    batchId,
    destinationAddress: rawDestinationAddress,
    ...record
  } = parseBody(farmPreparationSchema, body);
  const destinationAddress = rawDestinationAddress.toLowerCase();

  try {
    const farmer = await hasRole("FARMER", user.address);
    const existingBatch = await getBatch(batchId);
    const check = checkCanCreateBatch({
      role: farmer ? "FARMER" : null,
      batchExists: existingBatch.status !== "None",
    });

    if (!check.allowed) {
      throw new AppError(farmer ? 409 : 403, check.reason);
    }

    const [destination, destinationHasRole] = await Promise.all([
      participantRepository.findAvailability(destinationAddress),
      hasRole("MILL", destinationAddress),
    ]);
    if (!destination) {
      throw badRequest("destination must be a registered participant");
    }
    if (!destinationHasRole) {
      throw badRequest("destination must have MILL role");
    }
    if (!isAvailable(destination.availability)) {
      throw conflict("destination is marked unavailable");
    }

    const dataHash = computeRecordHash("farm", record);
    const data = batchCustody.interface.encodeFunctionData("createBatch", [
      batchId,
      destinationAddress,
      dataHash,
    ]);

    return {
      batchId,
      destinationAddress,
      destinationRole: "MILL",
      dataHash,
      transaction: {
        to: config.BATCH_CUSTODY_ADDRESS,
        data,
        value: "0x0",
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("chain read failed", err);
  }
}

export function prepareListing(user, body) {
  return prepareStageListing(user, body, LISTINGS.mill);
}

export function prepareStorageListing(user, body) {
  return prepareStageListing(user, body, LISTINGS.storage);
}

export function prepareExporterListing(user, body) {
  return prepareStageListing(user, body, LISTINGS.exporter);
}

export function prepareImporterListing(user, body) {
  return prepareStageListing(user, body, LISTINGS.importer);
}

async function prepareStageListing(user, body, spec) {
  const {
    batchId,
    destinationAddress: rawDestinationAddress,
    ...record
  } = parseBody(spec.schema, body);
  const destinationAddress = rawDestinationAddress.toLowerCase();

  try {
    const [hasStageRole, batch] = await Promise.all([
      hasRole(spec.role, user.address),
      getBatch(batchId),
    ]);
    if (!hasStageRole) throw forbidden(spec.roleError);
    if (batch.status === "None") throw notFound("batch not found");
    if (batch.stage !== spec.stage) throw conflict(spec.stageError);

    const check = checkCanPostForPickup({ batch, actor: user.address });
    if (!check.allowed) throw conflict(check.reason);

    if (spec.intakeType) {
      const intakeExists = await batchEventRepository.existsByBatchAndType(
        batchId,
        spec.intakeType,
      );
      if (!intakeExists) throw conflict(spec.intakeError);
    }

    const nextRole = getNextStageRole(batch.stage);
    const [destination, destinationHasRole] = await Promise.all([
      participantRepository.findAvailability(destinationAddress),
      hasRole(nextRole, destinationAddress),
    ]);
    if (!destination) {
      throw badRequest("destination must be a registered participant");
    }
    if (!destinationHasRole) {
      throw badRequest(`destination must have ${nextRole} role`);
    }
    if (!isAvailable(destination.availability)) {
      throw conflict("destination is marked unavailable");
    }

    const dataHash = computeRecordHash(spec.hashStage, record);
    const data = batchCustody.interface.encodeFunctionData("postForPickup", [
      batchId,
      destinationAddress,
      dataHash,
    ]);

    return {
      batchId,
      destinationAddress,
      destinationRole: nextRole,
      dataHash,
      transaction: {
        to: config.BATCH_CUSTODY_ADDRESS,
        data,
        value: "0x0",
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError(spec.failureMessage, err);
  }
}

export async function prepareClaim(user, body) {
  const batchId = parseBatchIdFromBody(body);

  try {
    const [transporter, batch] = await Promise.all([
      hasRole("TRANSPORTER", user.address),
      getBatch(batchId),
    ]);
    if (!transporter) throw forbidden("caller is not a transporter");
    if (batch.status === "None") throw notFound("batch not found");

    const check = checkCanClaimBatch({ batch, role: "TRANSPORTER" });
    if (!check.allowed) throw conflict(check.reason);

    // Only available transporters are in the pool that may claim jobs.
    const self = await participantRepository.findAvailability(
      user.address.toLowerCase(),
    );
    if (self && !isAvailable(self.availability)) {
      throw conflict("transporter is marked unavailable");
    }

    const availableJob =
      await transporterJobRepository.findAvailableByBatch(batchId);
    if (availableJob.length === 0) {
      throw conflict("no available transporter job for this batch");
    }

    const productType = batch.stage === "Farm" ? "olive" : "oil";
    const schema =
      productType === "olive"
        ? prepareOlivePickupSchema
        : prepareOilPickupSchema;
    const parsed = parseBody(schema, body);

    const { batchId: _batchId, ...record } = parsed;
    const dataHash = computeRecordHash(`transporter_${productType}`, record);
    const data = batchCustody.interface.encodeFunctionData("claimBatch", [
      batchId,
      dataHash,
    ]);

    return {
      batchId,
      productType,
      dataHash,
      transaction: {
        to: config.BATCH_CUSTODY_ADDRESS,
        data,
        value: "0x0",
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("chain read failed", err);
  }
}

export async function prepareHandover(user, body) {
  const batchId = parseBatchIdFromBody(body);

  try {
    const [transporter, batch] = await Promise.all([
      hasRole("TRANSPORTER", user.address),
      getBatch(batchId),
    ]);
    if (!transporter) throw forbidden("caller is not a transporter");
    if (batch.status === "None") throw notFound("batch not found");

    const expectedRole = getNextStageRole(batch.stage);
    const check = checkCanInitiateHandover({
      batch,
      actor: user.address,
      role: "TRANSPORTER",
      targetRole: expectedRole,
    });
    if (!check.allowed) throw conflict(check.reason);

    const schema =
      batch.stage === "Farm"
        ? prepareOliveDeliverySchema
        : prepareOilDeliverySchema;
    const parsed = parseBody(schema, body);
    const { targetAddress, batchId: _batchId, ...record } = parsed;

    const [job, targetHasNextRole] = await Promise.all([
      transporterJobRepository.findClaimedForTransporter(
        batchId,
        user.address.toLowerCase(),
      ),
      hasRole(expectedRole, targetAddress),
    ]);
    if (job.length === 0) {
      throw conflict("transporter has no claimed job for this batch");
    }
    if (job[0].destinationParty.toLowerCase() !== targetAddress.toLowerCase()) {
      throw badRequest(
        "target must match the destination selected for this job",
      );
    }
    if (!targetHasNextRole) {
      throw badRequest(`target must have ${expectedRole} role`);
    }

    const productType = batch.stage === "Farm" ? "olive" : "oil";
    const dataHash = computeRecordHash(
      `transporter_${productType}_outgoing`,
      record,
    );
    const data = batchCustody.interface.encodeFunctionData("initiateHandover", [
      batchId,
      targetAddress,
      dataHash,
    ]);

    return {
      batchId,
      targetAddress,
      productType,
      dataHash,
      transaction: {
        to: config.BATCH_CUSTODY_ADDRESS,
        data,
        value: "0x0",
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("handover preparation failed", err);
  }
}

export async function prepareReceipt(user, body) {
  const batchId = parseBatchIdFromBody(body);

  try {
    const batch = await getBatch(batchId);
    if (batch.status === "None") throw notFound("batch not found");

    const receivingStage = getStageAfter(batch.stage);
    const receipt = receivingStage && receiptSchemas[receivingStage];
    if (!receipt) {
      throw conflict(`receipt schema is not defined for stage ${batch.stage}`);
    }

    const expectedRole = getNextStageRole(batch.stage);
    if (!expectedRole) throw conflict("batch is already at final stage");

    const roleValid = await hasRole(expectedRole, user.address);
    if (!roleValid) {
      throw forbidden(`caller is not a ${expectedRole.toLowerCase()}`);
    }

    const check = checkCanConfirmReceipt({ batch, actor: user.address });
    if (!check.allowed) throw conflict(check.reason);

    const parsed = parseBody(
      receipt.schema.extend({ batchId: batchIdSchema }),
      body,
    );
    const { batchId: _batchId, ...record } = parsed;

    const dataHash = computeRecordHash(receipt.hashStage, record);
    const data = batchCustody.interface.encodeFunctionData("confirmReceipt", [
      batchId,
      dataHash,
    ]);

    return {
      batchId,
      dataHash,
      transaction: {
        to: config.BATCH_CUSTODY_ADDRESS,
        data,
        value: "0x0",
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("receipt preparation failed", err);
  }
}
