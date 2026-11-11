import { asc, eq } from "drizzle-orm";
import { batchCustody, provider } from "../src/chain/contracts.js";
import { syncEvents } from "../src/chain/eventIndex.js";
import { replayJobs } from "../src/chain/rebuild.js";
import { config } from "../src/config.js";
import { db } from "../src/db/db.js";
import {
  batches,
  batchEvents,
  chainEvents,
  participants,
  transporterJobs,
} from "../src/db/schema.js";

const dryRun = process.argv.includes("--dry-run");

async function readBatchIds(createdEvents) {
  const ids = new Map();
  for (const event of createdEvents) {
    const tx = await provider.getTransaction(event.txHash);
    const call =
      tx && batchCustody.interface.parseTransaction({ data: tx.data });
    if (call?.name !== "createBatch") {
      throw new Error(
        `cannot read the batch id from transaction ${event.txHash}`,
      );
    }
    ids.set(event.batchTopic.toLowerCase(), call.args[0]);
  }
  return ids;
}

const column = async (query, key) => (await query).map((row) => row[key]);

async function main() {
  await syncEvents();

  const events = await db
    .select()
    .from(chainEvents)
    .where(
      eq(
        chainEvents.contractAddress,
        config.BATCH_CUSTODY_ADDRESS.toLowerCase(),
      ),
    )
    .orderBy(asc(chainEvents.blockNumber), asc(chainEvents.logIndex));
  const batchIds = await readBatchIds(
    events.filter((event) => event.eventName === "BatchCreated"),
  );

  const recorded = new Set(
    await column(
      db.select({ txHash: batchEvents.eventTxHash }).from(batchEvents),
      "txHash",
    ),
  );
  const { jobs, wallets, unknownTopics } = replayJobs(events, {
    batchIds,
    hasRecord: (txHash) => recorded.has(txHash),
  });

  const knownBatches = new Set(
    await column(
      db.select({ batchId: batches.batchId }).from(batches),
      "batchId",
    ),
  );
  const knownWallets = new Set(
    await column(
      db
        .select({ walletAddress: participants.walletAddress })
        .from(participants),
      "walletAddress",
    ),
  );
  const newBatches = [...batchIds.values()].filter(
    (id) => !knownBatches.has(id),
  );
  const newWallets = wallets.filter((wallet) => !knownWallets.has(wallet));
  const orphanBatches = [...knownBatches].filter(
    (id) => ![...batchIds.values()].includes(id),
  );
  const currentJobs = (
    await column(
      db.select({ id: transporterJobs.id }).from(transporterJobs),
      "id",
    )
  ).length;

  console.log(
    `${events.length} custody events, ${batchIds.size} batches on chain`,
  );
  console.log(`batches to add: ${newBatches.length}`);
  console.log(`jobs: ${currentJobs} now, ${jobs.length} after the rebuild`);
  console.log(
    `jobs without their listing record: ${jobs.filter((job) => !job.listingTxHash).length}`,
  );
  if (newWallets.length > 0) {
    console.log(`participants to add (no profile): ${newWallets.join(", ")}`);
  }
  if (orphanBatches.length > 0) {
    console.log(
      `batches in the database with no chain events (left alone): ${orphanBatches.join(", ")}`,
    );
  }
  if (unknownTopics.length > 0) {
    console.log(
      `events for batches with no BatchCreated (skipped): ${unknownTopics.join(", ")}`,
    );
  }
  if (dryRun) {
    console.log("dry run: nothing written");
    return;
  }

  await db.transaction(async (tx) => {
    if (newWallets.length > 0) {
      await tx
        .insert(participants)
        .values(newWallets.map((walletAddress) => ({ walletAddress })));
    }
    if (newBatches.length > 0) {
      await tx
        .insert(batches)
        .values(newBatches.map((batchId) => ({ batchId })));
    }
    await tx.delete(transporterJobs);
    if (jobs.length > 0) await tx.insert(transporterJobs).values(jobs);
  });
  console.log("rebuilt");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`rebuild failed: ${err.message}`);
    process.exit(1);
  });
