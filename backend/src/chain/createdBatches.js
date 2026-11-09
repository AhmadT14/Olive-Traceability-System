import { blockTimeToIso, newestFirst } from "./eventOrder.js";

// Joins a farmer's BatchCreated events (from the chain) with the saved farm
// records (from the database). batchId is an indexed string on the event, so
// the log only carries its hash; the saved record, found by transaction hash,
// is what tells us the readable id and the harvest date.
//
// A batch created on chain but never saved through the API has no record to
// join, so it is left out.
export function matchCreatedBatches(events, records) {
  const recordsByTx = new Map(
    records.map((record) => [record.eventTxHash.toLowerCase(), record]),
  );

  return events
    .flatMap((event) => {
      const record = recordsByTx.get(event.txHash.toLowerCase());
      if (!record) return [];
      const harvestDate = record.details?.harvest_date;
      return [
        {
          batchId: record.batchId,
          createdBlock: event.blockNumber,
          createdAt: blockTimeToIso(event.timestamp),
          harvestDate:
            typeof harvestDate === "string" && harvestDate ? harvestDate : null,
        },
      ];
    })
    .sort(newestFirst("createdBlock"));
}
