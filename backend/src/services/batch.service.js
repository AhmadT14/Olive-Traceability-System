import { decodeTx, getBatch, hasRole } from "../chain/reader.js";
import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  internalError,
  notFound,
} from "../errors.js";
import {
  EventNotFoundError,
  HashMismatchError,
  verifyRecordAgainstChain,
} from "../hashing/verify.js";
import * as batchRepository from "../repositories/batch.repository.js";
import * as batchEventRepository from "../repositories/batchEvent.repository.js";
import * as participantRepository from "../repositories/participant.repository.js";
import * as transporterJobRepository from "../repositories/transporterJob.repository.js";
import { runInTransaction } from "../repositories/unitOfWork.js";
import { createBatchSchema } from "../validation/batch.schemas.js";
import { txHashSchema } from "../validation/common.schemas.js";
import {
  exporterListingSchema,
  importerListingSchema,
  millListingSchema,
  storageListingSchema,
} from "../validation/listing.schemas.js";
import { parseBatchId, parseBody } from "../validation/parse.js";
import { millReceiptSchema } from "../validation/receipt.schemas.js";

// Field names deliberately match HASH_FIELDS.* (snake_case) rather than the
// camelCase Drizzle column names, because this payload is passed straight into
// computeRecordHash â€” keeping the keys identical avoids a mapping that could
// drift out of sync with fields.js.

// Matches HASH_FIELDS.mill_olive exactly.
const millIntakeSchema = millReceiptSchema.extend({ txHash: txHashSchema });

// Matches HASH_FIELDS.mill_oil exactly.
const millOutgoingSchema = millListingSchema
  .omit({ batchId: true, destinationAddress: true })
  .extend({ txHash: txHashSchema });

const stageListingSchema = (schema) =>
  schema
    .omit({ batchId: true, destinationAddress: true })
    .extend({ txHash: txHashSchema });

const LISTINGS = {
  storage: {
    schema: stageListingSchema(storageListingSchema),
    role: "STORAGE",
    roleError: "caller is not a storage facility",
    stage: "Storage",
    stageError: "batch is not listed by a storage facility",
    hashStage: "storage_outgoing",
    intakeType: "storage_intake",
    intakeError: "no storage intake recorded off-chain for this batch yet",
  },
  exporter: {
    schema: stageListingSchema(exporterListingSchema),
    role: "EXPORTER",
    roleError: "caller is not an exporter",
    stage: "Exporter",
    stageError: "batch is not listed by an exporter",
    hashStage: "exporter_outgoing",
    intakeType: "exporter_intake",
    intakeError: "no exporter intake recorded off-chain for this batch yet",
  },
  importer: {
    schema: stageListingSchema(importerListingSchema),
    role: "IMPORTER",
    roleError: "caller is not an importer",
    stage: "Importer",
    stageError: "batch is not listed by an importer",
    hashStage: "importer_outgoing",
    intakeType: "importer_intake",
    intakeError: "no importer intake recorded off-chain for this batch yet",
  },
};

export async function recordFarmBatch(user, body) {
  const { txHash, batchId, ...record } = parseBody(createBatchSchema, body);

  let destinationParty;
  try {
    if (!(await hasRole("FARMER", user.address))) {
      throw forbidden("caller is not a farmer");
    }

    const decoded = await decodeTx(txHash);
    const creation = decoded?.events.find(
      (event) => event.name === "BatchCreated",
    );
    if (!decoded?.success || !creation) {
      throw notFound("tx not found or has no successful BatchCreated event");
    }
    if (creation.args.farmer?.toLowerCase() !== user.address.toLowerCase()) {
      throw forbidden("batch transaction was not submitted by caller");
    }

    destinationParty = creation.args.destinationAddress?.toLowerCase();
    if (!destinationParty) {
      throw conflict("batch event has no on-chain destination");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("chain read failed", err);
  }

  try {
    await verifyRecordAgainstChain("farm", txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) {
      throw conflict("record does not match the on-chain hash");
    }
    if (err instanceof EventNotFoundError) {
      throw notFound("tx not found or has no BatchCreated event");
    }
    throw internalError("chain read failed", err);
  }

  try {
    if (!(await participantRepository.exists(destinationParty))) {
      throw conflict(
        "on-chain destination is missing from the participant directory",
      );
    }
    if (await batchRepository.existsById(batchId)) {
      throw conflict("batch already recorded off-chain");
    }

    await runInTransaction(async (exec) => {
      await batchRepository.insert(batchId, exec);
      await batchEventRepository.insert(
        {
          eventTxHash: txHash,
          batchId,
          contractEvent: "BatchCreated",
          detailsType: "farm",
          payloadVersion: 1,
          details: record,
        },
        exec,
      );
      await transporterJobRepository.insert(
        {
          batchId,
          sourceParty: user.address.toLowerCase(),
          destinationParty,
          status: "available",
          listingTxHash: txHash,
        },
        exec,
      );
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("db write failed", err);
  }

  return { batchId, txHash };
}

export async function recordMillIntake(user, rawBatchId, body) {
  const batchId = parseBatchId(rawBatchId);
  const { txHash, ...record } = parseBody(millIntakeSchema, body);

  try {
    const [mill, batch] = await Promise.all([
      hasRole("MILL", user.address),
      getBatch(batchId),
    ]);
    if (!mill) throw forbidden("caller is not a mill");
    if (batch.status === "None") throw notFound("batch not found");
    if (
      batch.status !== "Created" ||
      batch.stage !== "Mill" ||
      batch.custodian.toLowerCase() !== user.address.toLowerCase()
    ) {
      throw conflict("caller is not the confirmed receipt custodian");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("chain read failed", err);
  }

  try {
    await verifyRecordAgainstChain("mill_olive", txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) {
      throw conflict("record does not match the on-chain hash");
    }
    if (err instanceof EventNotFoundError) {
      throw notFound(
        "tx not found or has no ReceiptConfirmed event for this batch",
      );
    }
    throw internalError("chain read failed", err);
  }

  try {
    if (!(await batchRepository.existsById(batchId))) {
      throw conflict("batch has no off-chain create record yet");
    }
    if (await batchEventRepository.existsByTxHash(txHash)) {
      throw conflict("record already recorded off-chain");
    }

    const decoded = await decodeTx(txHash);
    const receipt = decoded?.events.find(
      (event) =>
        event.name === "ReceiptConfirmed" &&
        event.args.newCustodian?.toLowerCase() === user.address.toLowerCase(),
    );
    if (!receipt) {
      throw conflict("receipt event was not submitted by caller");
    }

    const jobs =
      await transporterJobRepository.findPendingHandoverForDestination(
        batchId,
        user.address.toLowerCase(),
      );
    if (jobs.length === 0) {
      throw conflict("no transporter handover is pending for this batch");
    }

    await runInTransaction(async (exec) => {
      await batchEventRepository.insert(
        {
          eventTxHash: txHash,
          batchId,
          contractEvent: "ReceiptConfirmed",
          detailsType: "mill_intake",
          payloadVersion: 1,
          details: record,
        },
        exec,
      );

      const updated = await transporterJobRepository.transition(
        jobs[0].id,
        "handover_pending",
        { status: "completed", receiptTxHash: txHash },
        exec,
      );
      if (updated.length === 0) throw conflict("job state changed");
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("db write failed", err);
  }

  return { batchId, txHash };
}

export async function recordMillOutgoing(user, rawBatchId, body) {
  const batchId = parseBatchId(rawBatchId);
  const { txHash, ...record } = parseBody(millOutgoingSchema, body);

  try {
    const [mill, batch] = await Promise.all([
      hasRole("MILL", user.address),
      getBatch(batchId),
    ]);
    if (!mill) throw forbidden("caller is not a mill");
    if (batch.status === "None") throw notFound("batch not found");
    if (batch.stage !== "Mill" || batch.status !== "Listed") {
      throw conflict("batch is not listed by a mill");
    }
    if (batch.custodian.toLowerCase() !== user.address.toLowerCase()) {
      throw forbidden("caller is not current custodian");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("chain read failed", err);
  }

  try {
    await verifyRecordAgainstChain("mill_oil", txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) {
      throw conflict("record does not match the on-chain hash");
    }
    if (err instanceof EventNotFoundError) {
      throw notFound("tx not found or has no BatchListed event for this batch");
    }
    throw internalError("chain read failed", err);
  }

  try {
    const decoded = await decodeTx(txHash);
    const listing = decoded?.events.find(
      (event) =>
        event.name === "BatchListed" &&
        event.args.custodian?.toLowerCase() === user.address.toLowerCase(),
    );
    if (!listing) {
      throw conflict("listing event was not submitted by caller");
    }

    const destinationParty = listing.args.destinationAddress?.toLowerCase();
    if (!destinationParty) {
      throw conflict("listing event has no on-chain destination");
    }

    const [destinationExists, intakeExists, eventExists] = await Promise.all([
      participantRepository.exists(destinationParty),
      batchEventRepository.existsByBatchAndType(batchId, "mill_intake"),
      batchEventRepository.existsByTxHash(txHash),
    ]);
    if (!destinationExists) {
      throw conflict(
        "on-chain destination is missing from the participant directory",
      );
    }
    if (!intakeExists) {
      throw conflict("no mill intake recorded off-chain for this batch yet");
    }
    if (eventExists) {
      throw conflict("record already recorded off-chain");
    }

    await runInTransaction(async (exec) => {
      await batchEventRepository.insert(
        {
          eventTxHash: txHash,
          batchId,
          contractEvent: "BatchListed",
          detailsType: "mill_outgoing",
          payloadVersion: 1,
          details: record,
        },
        exec,
      );
      await transporterJobRepository.insert(
        {
          batchId,
          sourceParty: user.address.toLowerCase(),
          destinationParty,
          status: "available",
          listingTxHash: txHash,
        },
        exec,
      );
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.code === "23505") {
      throw conflict("record already recorded off-chain");
    }
    throw internalError("db write failed", err);
  }

  return { batchId, txHash };
}

// Storage, exporter and importer listings share one workflow; only the role,
// stage, hash key and intake event type differ.
export function recordStorageOutgoing(user, rawBatchId, body) {
  return recordStageListing(user, rawBatchId, body, LISTINGS.storage);
}

export function recordExporterOutgoing(user, rawBatchId, body) {
  return recordStageListing(user, rawBatchId, body, LISTINGS.exporter);
}

export function recordImporterOutgoing(user, rawBatchId, body) {
  return recordStageListing(user, rawBatchId, body, LISTINGS.importer);
}

async function recordStageListing(user, rawBatchId, body, spec) {
  const batchId = parseBatchId(rawBatchId);
  const { txHash, ...record } = parseBody(spec.schema, body);

  try {
    const [hasStageRole, batch] = await Promise.all([
      hasRole(spec.role, user.address),
      getBatch(batchId),
    ]);
    if (!hasStageRole) throw forbidden(spec.roleError);
    if (batch.status === "None") throw notFound("batch not found");
    if (batch.stage !== spec.stage || batch.status !== "Listed") {
      throw conflict(spec.stageError);
    }
    if (batch.custodian.toLowerCase() !== user.address.toLowerCase()) {
      throw forbidden("caller is not current custodian");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("chain read failed", err);
  }

  try {
    await verifyRecordAgainstChain(spec.hashStage, txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) {
      throw conflict("record does not match the on-chain hash");
    }
    if (err instanceof EventNotFoundError) {
      throw notFound("tx not found or has no BatchListed event for this batch");
    }
    throw internalError("chain read failed", err);
  }

  try {
    const decoded = await decodeTx(txHash);
    const listing = decoded?.events.find(
      (event) =>
        event.name === "BatchListed" &&
        event.args.custodian?.toLowerCase() === user.address.toLowerCase(),
    );
    if (!listing) {
      throw conflict("listing event was not submitted by caller");
    }

    const destinationParty = listing.args.destinationAddress?.toLowerCase();
    if (!destinationParty) {
      throw conflict("listing event has no on-chain destination");
    }

    const [destinationExists, intakeExists, batchExists, eventExists] =
      await Promise.all([
        participantRepository.exists(destinationParty),
        batchEventRepository.existsByBatchAndType(batchId, spec.intakeType),
        batchRepository.existsById(batchId),
        batchEventRepository.existsByTxHash(txHash),
      ]);
    if (!destinationExists) {
      throw conflict(
        "on-chain destination is missing from the participant directory",
      );
    }
    if (!intakeExists) throw conflict(spec.intakeError);
    if (!batchExists) {
      throw conflict("batch has no off-chain create record yet");
    }
    if (eventExists) throw conflict("record already recorded off-chain");

    await runInTransaction(async (exec) => {
      await batchEventRepository.insert(
        {
          eventTxHash: txHash,
          batchId,
          contractEvent: "BatchListed",
          detailsType: spec.hashStage,
          payloadVersion: 1,
          details: record,
        },
        exec,
      );
      await transporterJobRepository.insert(
        {
          batchId,
          sourceParty: user.address.toLowerCase(),
          destinationParty,
          status: "available",
          listingTxHash: txHash,
        },
        exec,
      );
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.code === "23505") {
      throw conflict("record already recorded off-chain");
    }
    throw internalError("db write failed", err);
  }

  return { batchId, txHash };
}
