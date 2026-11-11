import {
  getBatch,
  getBatchHistory as readBatchHistory,
} from "../chain/reader.js";
import { collectAddresses } from "../chain/addresses.js";
import { internalError, notFound } from "../errors.js";
import * as batchEventRepository from "../db/repositories/batchEvent.repository.js";
import * as participantRepository from "../db/repositories/participant.repository.js";
import { parseBatchId } from "../validation/parse.js";
import { batchExists } from "../chain/enums.js";

export async function getChainBatch(rawBatchId) {
  const batchId = parseBatchId(rawBatchId);

  let batch;
  try {
    batch = await getBatch(batchId);
  } catch (err) {
    throw internalError("chain read failed", err);
  }

  if (!batchExists(batch)) throw notFound("batch not found on chain");

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

  // Names for every wallet in the journey, so a viewer needs no further
  // request per facility. Wallets with no profile are left out of the map.
  let profiles;
  try {
    profiles = await participantRepository.findPublicProfiles(
      collectAddresses(chainEvents),
    );
  } catch (err) {
    throw internalError("history lookup failed", err);
  }
  const participants = Object.fromEntries(
    profiles.map((p) => [
      p.address,
      { name: p.name ?? null, location: p.location ?? null },
    ]),
  );

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

  return { batchId, events, participants };
}
