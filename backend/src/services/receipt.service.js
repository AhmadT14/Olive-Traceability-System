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
import * as batchEventRepository from "../db/repositories/batchEvent.repository.js";
import * as transporterJobRepository from "../db/repositories/transporterJob.repository.js";
import { runInTransaction } from "../db/repositories/unitOfWork.js";
import { parseBatchId, parseBody, parseTxHash } from "../validation/parse.js";
import { receiptSchemas } from "../validation/receipt.schemas.js";
import { sameAddress } from "../chain/addresses.js";
import { batchExists } from "../chain/enums.js";
import { confirmDraft } from "./drafts.js";

export async function recordReceipt(user, rawBatchId, body) {
  const batchId = parseBatchId(rawBatchId);
  const txHash = parseTxHash(body?.txHash);

  let definition;
  try {
    const batch = await getBatch(batchId);
    if (!batchExists(batch)) throw notFound("batch not found");

    definition = receiptSchemas[batch.stage];
    if (!definition) {
      throw conflict(
        `receipt persistence is not defined for stage ${batch.stage}`,
      );
    }
    if (
      batch.status !== "Created" ||
      !sameAddress(batch.custodian, user.address)
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

  const record = parseBody(definition.schema, body);

  let decoded;
  let dataHash;
  try {
    ({ decoded, computedHash: dataHash } = await verifyRecordAgainstChain(
      definition.hashStage,
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
        "tx not found or has no ReceiptConfirmed event for this batch",
      );
    }
    throw internalError("chain read failed", err);
  }

  await writeReceipt({
    wallet: user.address,
    batchId,
    txHash,
    record,
    decoded,
    dataHash,
    detailsType: definition.detailsType,
  });
  return { batchId, txHash, stage: definition.hashStage };
}

export async function writeReceipt({
  wallet,
  batchId,
  txHash,
  record,
  decoded,
  dataHash,
  detailsType,
}) {
  try {
    const receipt = decoded?.events.find(
      (event) =>
        event.name === "ReceiptConfirmed" &&
        sameAddress(event.args.newCustodian, wallet),
    );
    if (!receipt) {
      throw conflict("receipt event was not submitted by caller");
    }

    const jobs =
      await transporterJobRepository.findPendingHandoverForDestination(
        batchId,
        wallet.toLowerCase(),
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
          detailsType,
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
      await confirmDraft(wallet, batchId, dataHash, txHash, exec);
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (isUniqueViolation(err)) {
      throw conflict("event details already recorded");
    }
    throw internalError("db write failed", err);
  }
}
