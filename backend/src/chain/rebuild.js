const lower = (value) => String(value).toLowerCase();

const OPENING_PARTY = { BatchCreated: "farmer", BatchListed: "custodian" };

const recordHash = (hasRecord, txHash) => (hasRecord(txHash) ? txHash : null);

function openJob(event, hasRecord) {
  return {
    sourceParty: lower(event.args[OPENING_PARTY[event.eventName]]),
    destinationParty: lower(event.args.destinationAddress),
    transporter: null,
    status: "available",
    listingTxHash: recordHash(hasRecord, event.txHash),
    claimTxHash: null,
    handoverTxHash: null,
    receiptTxHash: null,
    reserveTxHash: null,
    reservedAt: null,
    createdAt: event.blockTime ?? null,
  };
}

const TRANSITIONS = {
  BatchReserved: (event) => ({
    status: "reserved",
    transporter: lower(event.args.transporter),
    reserveTxHash: event.txHash,
    reservedAt: event.blockTime ?? null,
  }),
  ReservationReleased: () => ({
    status: "available",
    transporter: null,
    reserveTxHash: null,
    reservedAt: null,
  }),
  BatchClaimed: (event, hasRecord) => ({
    status: "claimed",
    transporter: lower(event.args.transporter),
    claimTxHash: recordHash(hasRecord, event.txHash),
  }),
  HandoverInitiated: (event, hasRecord) => ({
    status: "handover_pending",
    handoverTxHash: recordHash(hasRecord, event.txHash),
  }),
  ReceiptConfirmed: (event, hasRecord) => ({
    status: "completed",
    receiptTxHash: recordHash(hasRecord, event.txHash),
  }),
};

export function replayBatchJobs(events, hasRecord) {
  const jobs = [];
  let current = null;
  for (const event of events) {
    if (OPENING_PARTY[event.eventName]) {
      current = openJob(event, hasRecord);
      jobs.push(current);
      continue;
    }
    const transition = TRANSITIONS[event.eventName];
    if (transition && current) {
      Object.assign(current, transition(event, hasRecord));
      if (current.status === "completed") current = null;
    }
  }
  return jobs;
}

export function replayJobs(events, { batchIds, hasRecord }) {
  const byTopic = new Map();
  for (const event of events) {
    if (!event.batchTopic) continue;
    const topic = lower(event.batchTopic);
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic).push(event);
  }

  const jobs = [];
  const unknownTopics = [];
  for (const [topic, batchEvents] of byTopic) {
    const batchId = batchIds.get(topic);
    if (batchId === undefined) {
      unknownTopics.push(topic);
      continue;
    }
    for (const job of replayBatchJobs(batchEvents, hasRecord)) {
      jobs.push({ batchId, ...job });
    }
  }

  const wallets = new Set(
    jobs.flatMap((job) =>
      [job.sourceParty, job.destinationParty, job.transporter].filter(Boolean),
    ),
  );
  return { jobs, wallets: [...wallets], unknownTopics };
}
