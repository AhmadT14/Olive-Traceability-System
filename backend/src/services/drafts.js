import { sameAddress } from "../chain/addresses.js";
import { internalError } from "../errors.js";
import * as pendingSaveRepository from "../db/repositories/pendingSave.repository.js";

export async function saveDraft(user, batchId, detailsType, record, dataHash) {
  try {
    await pendingSaveRepository.insert({
      walletAddress: user.address.toLowerCase(),
      batchId,
      detailsType,
      payload: record,
      dataHash,
    });
  } catch (err) {
    throw internalError("draft save failed", err);
  }
}

export async function confirmDraft(wallet, batchId, dataHash, txHash, exec) {
  const [draft] = await pendingSaveRepository.findPendingByBatchAndHash(
    batchId,
    dataHash,
    exec,
  );
  if (!draft || !sameAddress(draft.walletAddress, wallet)) return;
  await pendingSaveRepository.resolve(
    draft.id,
    { status: "confirmed", txHash },
    exec,
  );
}
