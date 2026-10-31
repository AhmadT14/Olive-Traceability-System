// Joins a farmer's BatchCreated events (from the chain) with the saved farm
// records (from the database). batchId is an indexed string on the event, so
// the log only carries its hash; the saved record, found by transaction hash,
// is what tells us the readable id and the harvest date.
//
// A batch created on chain but never saved through the API has no record to
// join, so it is left out.
export function matchCreatedBatches(events, rows) {
  const recordsByTx = new Map(
    rows.map((row) => [row.eventTxHash.toLowerCase(), row]),
  );

  return events
    .flatMap((event) => {
      const row = recordsByTx.get(event.txHash.toLowerCase());
      if (!row) return [];
      const harvestDate = row.details?.harvest_date;
      return [
        {
          batchId: row.batchId,
          createdBlock: event.blockNumber,
          createdAt: new Date(event.timestamp * 1000).toISOString(),
          harvestDate:
            typeof harvestDate === "string" && harvestDate ? harvestDate : null,
        },
      ];
    })
    .sort(
      (a, b) =>
        b.createdBlock - a.createdBlock || a.batchId.localeCompare(b.batchId),
    );
}
