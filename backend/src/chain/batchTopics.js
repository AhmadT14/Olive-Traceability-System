import { id } from "ethers";

export function matchBatchIdsByTopic(events, batchIds) {
  const byTopic = new Map(
    batchIds.map((batchId) => [id(batchId).toLowerCase(), batchId]),
  );

  return events
    .flatMap((event) => {
      const batchId = byTopic.get(event.batchTopic.toLowerCase());
      if (batchId === undefined) return [];
      return [
        {
          batchId,
          txHash: event.txHash,
          receivedBlock: event.blockNumber,
          receivedAt: new Date(event.timestamp * 1000).toISOString(),
        },
      ];
    })
    .sort(
      (a, b) =>
        b.receivedBlock - a.receivedBlock || a.batchId.localeCompare(b.batchId),
    );
}
