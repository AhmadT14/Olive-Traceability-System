import { getBatch, hasRole } from "../chain/reader.js";
import {
  AppError,
  conflict,
  forbidden,
  internalError,
  isUniqueViolation,
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
import { sameAddress } from "../chain/addresses.js";
import { batchExists } from "../chain/enums.js";
import { confirmDraft } from "./drafts.js";

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
    if (!batchExists(batch)) throw notFound("batch not found");
    if (
      batch.status !== "Created" ||
      !sameAddress(batch.custodian, user.address)
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

  let decoded;
  let dataHash;
  try {
    ({ decoded, computedHash: dataHash } = await verifyRecordAgainstChain(
      hashStage,
      txHash,
      batchId,
      record,
    ));
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

  await writeClaim({
    wallet: user.address,
    batchId,
    txHash,
    record,
    decoded,
    dataHash,
    productType,
  });
  return {
    batchId,
    txHash,
    transporter: user.address.toLowerCase(),
    productType,
  };
}

export async function writeClaim({
  wallet,
  batchId,
  txHash,
  record,
  decoded,
  dataHash,
  productType,
}) {
  try {
    const claim = decoded?.events.find(
      (event) =>
        event.name === "BatchClaimed" &&
        sameAddress(event.args.transporter, wallet),
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
          transporter: wallet.toLowerCase(),
          status: "claimed",
          claimTxHash: txHash,
        },
        exec,
      );
      if (updated.length === 0) throw conflict("job already claimed");
      await confirmDraft(wallet, batchId, dataHash, txHash, exec);
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (isUniqueViolation(err)) {
      throw conflict("record already recorded off-chain");
    }
    throw internalError("db write failed", err);
  }
}

export async function handoverBatch(user, rawBatchId, body) {
  const batchId = parseBatchId(rawBatchId);

  let productType;
  try {
    const [transporter, currentBatch] = await Promise.all([
      hasRole("TRANSPORTER", user.address),
      getBatch(batchId),
    ]);
    if (!transporter) throw forbidden("caller is not a transporter");
    if (!batchExists(currentBatch)) throw notFound("batch not found");
    if (
      currentBatch.status !== "PendingHandover" ||
      !sameAddress(currentBatch.custodian, user.address)
    ) {
      throw conflict("no pending handover from this transporter");
    }
    productType = productTypeFor(currentBatch);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("chain read failed", err);
  }

  const schema =
    productType === "olive" ? oliveDeliverySchema : oilDeliverySchema;
  const { txHash, ...record } = parseBody(schema, body);
  const hashStage = `transporter_${productType}_outgoing`;

  let decoded;
  let dataHash;
  try {
    ({ decoded, computedHash: dataHash } = await verifyRecordAgainstChain(
      hashStage,
      txHash,
      batchId,
      record,
    ));
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

  const targetAddress = await writeHandover({
    wallet: user.address,
    batchId,
    txHash,
    record,
    decoded,
    dataHash,
    productType,
  });
  return { batchId, txHash, targetAddress, productType };
}

export async function writeHandover({
  wallet,
  batchId,
  txHash,
  record,
  decoded,
  dataHash,
  productType,
}) {
  try {
    const handover = decoded?.events.find(
      (event) =>
        event.name === "HandoverInitiated" &&
        sameAddress(event.args.currentCustodian, wallet),
    );
    if (!handover) {
      throw conflict("handover event was not submitted by caller");
    }
    const targetAddress = handover.args.targetAddress;

    const job = await transporterJobRepository.findClaimedForHandover(
      batchId,
      wallet.toLowerCase(),
      targetAddress.toLowerCase(),
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
      await confirmDraft(wallet, batchId, dataHash, txHash, exec);
    });
    return targetAddress;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (isUniqueViolation(err)) {
      throw conflict("record already recorded off-chain");
    }
    throw internalError("db write failed", err);
  }
}
