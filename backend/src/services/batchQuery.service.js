import {
  getBatch,
  getBatchHistory as readBatchHistory,
} from "../chain/reader.js";
import { internalError, notFound } from "../errors.js";
import * as batchEventRepository from "../repositories/batchEvent.repository.js";
import { parseBatchId } from "../validation/parse.js";

export async function getChainBatch(rawBatchId) {
  const batchId = parseBatchId(rawBatchId);

  let batch;
  try {
    batch = await getBatch(batchId);
  } catch (err) {
    throw internalError("chain read failed", err);
  }

  if (batch.status === "None") throw notFound("batch not found on chain");

  return { batchId, ...batch };
}

export async function getBatchHistoryView(rawBatchId) {
  const batchId = parseBatchId(rawBatchId);

  let chainEvents;
  let detailsRows;
  try {
    [chainEvents, detailsRows] = await Promise.all([
      readBatchHistory(batchId),
      batchEventRepository.findDetailsByBatchId(batchId),
    ]);
  } catch (err) {
    throw internalError("history lookup failed", err);
  }

  if (chainEvents.length === 0) {
    throw notFound("no events found for this batch");
  }

  const detailsByTxHash = new Map(
    detailsRows.map((row) => [row.eventTxHash.toLowerCase(), row]),
  );

  const events = chainEvents.map((event) => {
    const details = detailsByTxHash.get(event.txHash.toLowerCase());
    return {
      ...event,
      details: details
        ? {
            type: details.detailsType,
            payloadVersion: details.payloadVersion,
            recordedAt: details.recordedAt,
            values: details.details,
          }
        : null,
    };
  });

  return { batchId, events };
}
