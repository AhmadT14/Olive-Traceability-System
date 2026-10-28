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
import * as batchEventRepository from "../repositories/batchEvent.repository.js";
import * as transporterJobRepository from "../repositories/transporterJob.repository.js";
import { runInTransaction } from "../repositories/unitOfWork.js";
import { parseBatchId, parseOrThrow } from "../validation/parse.js";
import { receiptSchemas } from "../validation/receipt.schemas.js";

export async function recordReceipt(user, rawBatchId, body) {
  const batchId = parseBatchId(rawBatchId);

  const txHash = body?.txHash;
  if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw badRequest("invalid tx hash");
  }

  let definition;
  try {
    const batch = await getBatch(batchId);
    if (batch.status === "None") throw notFound("batch not found");

    definition = receiptSchemas[batch.stage];
    if (!definition) {
      throw conflict(
        `receipt persistence is not defined for stage ${batch.stage}`,
      );
    }
    if (
      batch.status !== "Created" ||
      batch.custodian.toLowerCase() !== user.address.toLowerCase()
    ) {
      throw conflict("caller is not the confirmed receipt custodian");
    }
    if (!(await hasRole(definition.role, user.address))) {
      throw forbidden(`caller is not a ${definition.role.toLowerCase()}`);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("chain read failed", err);
  }

  const record = parseOrThrow(definition.schema, body);

  try {
    await verifyRecordAgainstChain(
      definition.hashStage,
      txHash,
      batchId,
      record,
    );
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
    const decoded = await decodeTx(txHash);
    const receipt = decoded?.events.find(
      (event) =>
        event.name === "ReceiptConfirmed" &&
        event.args.newCustodian?.toLowerCase() === user.address.toLowerCase(),
    );
    if (!receipt) {
      throw conflict("receipt event was not submitted by caller");
    }

    const jobs = await transporterJobRepository.findPendingHandoverForDestination(
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
          detailsType: definition.detailsType,
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
    if (err.code === "23505") {
      throw conflict("event details already recorded");
    }
    throw internalError("db write failed", err);
  }

  return { batchId, txHash, stage: definition.hashStage };
}
