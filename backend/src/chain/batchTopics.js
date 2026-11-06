import { id } from "ethers";
import { blockTimeToIso, newestFirst } from "./eventOrder.js";

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
          receivedAt: blockTimeToIso(event.timestamp),
        },
      ];
    })
    .sort(newestFirst("receivedBlock"));
}
