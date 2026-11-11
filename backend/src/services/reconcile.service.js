import { sameAddress } from "../chain/addresses.js";
import { getBatchHistory } from "../chain/reader.js";
import { verifyRecordAgainstChain } from "../hashing/verify.js";
import * as batchEventRepository from "../db/repositories/batchEvent.repository.js";
import * as pendingSaveRepository from "../db/repositories/pendingSave.repository.js";
import { receiptSchemas } from "../validation/receipt.schemas.js";
import {
  writeFarmBatch,
  writeListing,
  writeMillIntake,
} from "./batch.service.js";
import { writeReceipt } from "./receipt.service.js";
import { writeClaim, writeHandover } from "./transporter.service.js";

const BATCH_LIMIT = 50;

const save = (stageKey, event, sender, hash, write) => ({
  stageKey,
  event,
  sender,
  hash,
  write,
});
const listing = (stageKey) =>
  save(stageKey, "BatchListed", "custodian", "outgoingDataHash", writeListing);
const receipt = (stageKey) =>
  save(
    stageKey,
    "ReceiptConfirmed",
    "newCustodian",
    "intakeDataHash",
    writeReceipt,
  );

const SAVES = {
  farm: save(
    "farm",
    "BatchCreated",
    "farmer",
    "harvestDataHash",
    writeFarmBatch,
  ),
  mill_intake: save(
    "mill_olive",
    "ReceiptConfirmed",
    "newCustodian",
    "intakeDataHash",
    writeMillIntake,
  ),
  mill_outgoing: listing("mill_oil"),
  storage_outgoing: listing("storage_outgoing"),
  exporter_outgoing: listing("exporter_outgoing"),
  importer_outgoing: listing("importer_outgoing"),
};
for (const product of ["olive", "oil"]) {
  SAVES[`transporter_${product}_pickup`] = save(
    `transporter_${product}`,
    "BatchClaimed",
    "transporter",
    "intakeDataHash",
    writeClaim,
  );
  SAVES[`transporter_${product}_delivery`] = save(
    `transporter_${product}_outgoing`,
    "HandoverInitiated",
    "currentCustodian",
    "outgoingDataHash",
    writeHandover,
  );
}
for (const definition of Object.values(receiptSchemas)) {
  SAVES[definition.detailsType] ??= receipt(definition.hashStage);
}

const productTypeOf = (detailsType) =>
  detailsType.startsWith("transporter_oil_") ? "oil" : "olive";

function findMinedEvent(draft, spec, history) {
  return history.find(
    (event) =>
      event.name === spec.event &&
      String(event.args[spec.hash]).toLowerCase() ===
        draft.dataHash.toLowerCase() &&
      sameAddress(event.args[spec.sender], draft.walletAddress),
  );
}

function fail(draft, reason) {
  return pendingSaveRepository.resolve(draft.id, {
    status: "failed",
    failureReason: reason,
  });
}

async function settleSavedTx(draft, txHash) {
  const [owner] = await pendingSaveRepository.findByTxHash(txHash);
  if (owner) {
    await fail(draft, "details already saved from another draft");
    return "failed";
  }
  await pendingSaveRepository.resolve(draft.id, {
    status: "confirmed",
    txHash,
  });
  return "confirmed";
}

async function reconcileDraft(draft, readHistory, expired) {
  const spec = SAVES[draft.detailsType];
  if (!spec) {
    await fail(draft, "unknown record type");
    return "failed";
  }

  try {
    const event = findMinedEvent(draft, spec, await readHistory(draft.batchId));
    if (!event) {
      if (!expired) return "pending";
      await fail(draft, "no matching transaction was mined");
      return "failed";
    }

    if (await batchEventRepository.existsByTxHash(event.txHash)) {
      return await settleSavedTx(draft, event.txHash);
    }

    const { decoded, computedHash } = await verifyRecordAgainstChain(
      spec.stageKey,
      event.txHash,
      draft.batchId,
      draft.payload,
    );
    await spec.write({
      wallet: draft.walletAddress,
      batchId: draft.batchId,
      txHash: event.txHash,
      record: draft.payload,
      decoded,
      dataHash: computedHash,
      detailsType: draft.detailsType,
      productType: productTypeOf(draft.detailsType),
    });
    return "confirmed";
  } catch (err) {
    if (!expired) return "pending";
    await fail(draft, err.message);
    return "failed";
  }
}

export async function reconcilePendingSaves({ maxAgeMs, now = Date.now() }) {
  const drafts = await pendingSaveRepository.listPending(BATCH_LIMIT);
  const histories = new Map();
  const readHistory = (batchId) => {
    if (!histories.has(batchId)) {
      histories.set(batchId, getBatchHistory(batchId));
    }
    return histories.get(batchId);
  };

  const counts = { confirmed: 0, failed: 0, pending: 0 };
  for (const draft of drafts) {
    const expired = now - new Date(draft.createdAt).getTime() > maxAgeMs;
    counts[await reconcileDraft(draft, readHistory, expired)] += 1;
  }
  return counts;
}

export function startReconciler({ intervalMs, maxAgeMs }) {
  let running = false;
  return setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await reconcilePendingSaves({ maxAgeMs });
    } catch (err) {
      console.error("reconciler run failed:", err);
    } finally {
      running = false;
    }
  }, intervalMs);
}
