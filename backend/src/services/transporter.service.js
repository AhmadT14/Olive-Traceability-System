import { decodeTx, getBatch, hasRole } from "../chain/reader.js";
import {
  AppError,
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
import * as batchEventRepository from "../repositories/batchEvent.repository.js";
import * as transporterJobRepository from "../repositories/transporterJob.repository.js";
import { runInTransaction } from "../repositories/unitOfWork.js";
import { parseBatchId, parseBody } from "../validation/parse.js";
import {
  oilDeliverySchema,
  oilPickupSchema,
  oliveDeliverySchema,
  olivePickupSchema,
} from "../validation/transporter.schemas.js";

const productTypeFor = (batch) => (batch.stage === "Farm" ? "olive" : "oil");

export async function claimBatch(user, rawBatchId, body) {
  const batchId = parseBatchId(rawBatchId);

  let productType;
  try {
    const [transporter, batch] = await Promise.all([
      hasRole("TRANSPORTER", user.address),
      getBatch(batchId),
    ]);
    if (!transporter) throw forbidden("caller is not a transporter");
    if (batch.status === "None") throw notFound("batch not found");
    if (
      batch.status !== "Created" ||
      batch.custodian.toLowerCase() !== user.address.toLowerCase()
    ) {
      throw conflict("transporter does not hold this claimed batch");
    }
    productType = productTypeFor(batch);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("chain read failed", err);
  }

  const schema = productType === "olive" ? olivePickupSchema : oilPickupSchema;
  const { txHash, ...record } = parseBody(schema, body);
  const hashStage = `transporter_${productType}`;

  try {
    await verifyRecordAgainstChain(hashStage, txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) {
      throw conflict("record does not match the on-chain hash");
    }
    if (err instanceof EventNotFoundError) {
      throw notFound(
        "tx not found or has no BatchClaimed event for this batch",
      );
    }
    throw internalError("chain read failed", err);
  }

  try {
    const decoded = await decodeTx(txHash);
    const claim = decoded?.events.find(
      (event) =>
        event.name === "BatchClaimed" &&
        event.args.transporter?.toLowerCase() === user.address.toLowerCase(),
    );
    if (!claim) {
      throw conflict("claim event was not submitted by caller");
    }

    const jobs = await transporterJobRepository.findAvailableByBatch(batchId);
    if (jobs.length === 0) {
      throw conflict("no available transporter job for this batch");
    }

    await runInTransaction(async (exec) => {
      await batchEventRepository.insert(
        {
          eventTxHash: txHash,
          batchId,
          contractEvent: "BatchClaimed",
          detailsType: `transporter_${productType}_pickup`,
          payloadVersion: 1,
          details: record,
        },
        exec,
      );

      const updated = await transporterJobRepository.transition(
        jobs[0].id,
        "available",
        {
          transporter: user.address.toLowerCase(),
          status: "claimed",
          claimTxHash: txHash,
        },
        exec,
      );
      if (updated.length === 0) throw conflict("job already claimed");
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("db write failed", err);
  }

  return {
    batchId,
    txHash,
    transporter: user.address.toLowerCase(),
    productType,
  };
}

export async function handoverBatch(user, rawBatchId, body) {
  const batchId = parseBatchId(rawBatchId);

  let batch;
  let productType;
  try {
    const [transporter, currentBatch] = await Promise.all([
      hasRole("TRANSPORTER", user.address),
      getBatch(batchId),
    ]);
    if (!transporter) throw forbidden("caller is not a transporter");
    if (currentBatch.status === "None") throw notFound("batch not found");
    if (
      currentBatch.status !== "PendingHandover" ||
      currentBatch.custodian.toLowerCase() !== user.address.toLowerCase()
    ) {
      throw conflict("no pending handover from this transporter");
    }
    batch = currentBatch;
    productType = productTypeFor(batch);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("chain read failed", err);
  }

  const schema =
    productType === "olive" ? oliveDeliverySchema : oilDeliverySchema;
  const { txHash, ...record } = parseBody(schema, body);
  const hashStage = `transporter_${productType}_outgoing`;

  try {
    await verifyRecordAgainstChain(hashStage, txHash, batchId, record);
  } catch (err) {
    if (err instanceof HashMismatchError) {
      throw conflict("record does not match the on-chain hash");
    }
    if (err instanceof EventNotFoundError) {
      throw notFound(
        "tx not found or has no HandoverInitiated event for this batch",
      );
    }
    throw internalError("chain read failed", err);
  }

  try {
    const decoded = await decodeTx(txHash);
    const handover = decoded?.events.find(
      (event) =>
        event.name === "HandoverInitiated" &&
        event.args.currentCustodian?.toLowerCase() ===
          user.address.toLowerCase() &&
        event.args.targetAddress?.toLowerCase() ===
          batch.pendingTarget.toLowerCase(),
    );
    if (!handover) {
      throw conflict("handover event does not match caller and pending target");
    }

    const job = await transporterJobRepository.findClaimedForHandover(
      batchId,
      user.address.toLowerCase(),
      batch.pendingTarget.toLowerCase(),
    );
    if (job.length === 0) {
      throw conflict("no matching claimed job for this handover");
    }

    await runInTransaction(async (exec) => {
      await batchEventRepository.insert(
        {
          eventTxHash: txHash,
          batchId,
          contractEvent: "HandoverInitiated",
          detailsType: `transporter_${productType}_delivery`,
          payloadVersion: 1,
          details: record,
        },
        exec,
      );

      const updated = await transporterJobRepository.transition(
        job[0].id,
        "claimed",
        { status: "handover_pending", handoverTxHash: txHash },
        exec,
      );
      if (updated.length === 0) throw conflict("job state changed");
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("db write failed", err);
  }

  return {
    batchId,
    txHash,
    targetAddress: batch.pendingTarget,
    productType,
  };
}
