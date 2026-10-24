import * as p from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const wallet = (name) => p.varchar(name, { length: 42 });
const txHash = (name) => p.varchar(name, { length: 66 });

export const participants = p.pgTable("participants", {
  walletAddress: wallet("wallet_address").primaryKey(),
  name: p.varchar("name", { length: 255 }),
  role: p.varchar("role", { length: 32 }),
  status: p.varchar("status", { length: 32 }),
  availability: p.varchar("availability", { length: 32 }),
  registeredAt: p.timestamp("registered_at"),
  approvedBy: wallet("approved_by"),
  approvedAt: p.timestamp("approved_at"),
  registerTxHash: txHash("register_tx_hash"),
});

export const batches = p.pgTable(
  "batches",
  {
    batchId: p.varchar("batch_id", { length: 64 }).primaryKey(),
    farmer: wallet("farmer").references(() => participants.walletAddress),
    harvestDate: p.date("harvest_date"),
    location: p.varchar("location", { length: 255 }),
    oliveType: p.varchar("olive_type", { length: 128 }),
    createTxHash: txHash("create_tx_hash"),
    createdAt: p.timestamp("created_at").defaultNow(),
  },
  (t) => [p.index("batches_farmer_idx").on(t.farmer)],
);

export const batchEvents = p.pgTable(
  "batch_events",
  {
    eventTxHash: txHash("event_tx_hash").primaryKey(),
    batchId: p.varchar("batch_id", { length: 64 }).notNull().references(() => batches.batchId),
    contractEvent: p.varchar("contract_event", { length: 32 }).notNull(),
    detailsType: p.varchar("details_type", { length: 40 }).notNull(),
    payloadVersion: p.smallint("payload_version").notNull().default(1),
    details: p.jsonb("details").notNull(),
    recordedAt: p.timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    p.check(
      "batch_events_contract_event_check",
      sql`${t.contractEvent} IN ('BatchCreated', 'BatchListed', 'BatchClaimed', 'HandoverInitiated', 'ReceiptConfirmed')`,
    ),
    p.check(
      "batch_events_details_type_check",
      sql`${t.detailsType} IN ('farm', 'transporter_olive_pickup', 'transporter_oil_pickup', 'transporter_olive_delivery', 'transporter_oil_delivery', 'mill_intake', 'mill_outgoing', 'storage_intake', 'storage_outgoing', 'exporter_intake', 'exporter_outgoing', 'importer_intake', 'importer_outgoing', 'retailer_intake')`,
    ),
    p.check("batch_events_payload_version_check", sql`${t.payloadVersion} > 0`),
    p.check("batch_events_details_object_check", sql`jsonb_typeof(${t.details}) = 'object'`),
    p.unique("batch_events_batch_tx_unique").on(t.batchId, t.eventTxHash),
    p.index("batch_events_batch_id_idx").on(t.batchId),
    p.index("batch_events_details_type_idx").on(t.detailsType),
  ],
);

export const participantProfiles = p.pgTable("participant_profiles", {
  walletAddress: wallet("wallet_address").primaryKey().references(() => participants.walletAddress, { onDelete: "cascade" }),
  name: p.varchar("name", { length: 255 }),
  contactPhone: p.varchar("contact_phone", { length: 64 }),
  email: p.varchar("email", { length: 255 }),
  address: p.text("address"),
  location: p.varchar("location", { length: 255 }),
  details: p.jsonb("details").notNull().default({}),
});

const batchRef = () => p.varchar("batch_id", { length: 64 }).notNull().references(() => batches.batchId);

export const transporterJobs = p.pgTable(
  "transporter_jobs",
  {
    id: p.integer("id").primaryKey().generatedAlwaysAsIdentity(),
    batchId: batchRef(),
    sourceParty: wallet("source_party").notNull().references(() => participants.walletAddress),
    destinationParty: wallet("destination_party").notNull().references(() => participants.walletAddress),
    transporter: wallet("transporter").references(() => participants.walletAddress),
    status: p.varchar("status", { length: 32 }).notNull(),
    listingTxHash: txHash("listing_tx_hash"),
    claimTxHash: txHash("claim_tx_hash"),
    handoverTxHash: txHash("handover_tx_hash"),
    receiptTxHash: txHash("receipt_tx_hash"),
    createdAt: p.timestamp("created_at").defaultNow(),
  },
  (t) => [
    p.foreignKey({
      name: "transporter_jobs_listing_event_fk",
      columns: [t.batchId, t.listingTxHash],
      foreignColumns: [batchEvents.batchId, batchEvents.eventTxHash],
    }),
    p.foreignKey({
      name: "transporter_jobs_claim_event_fk",
      columns: [t.batchId, t.claimTxHash],
      foreignColumns: [batchEvents.batchId, batchEvents.eventTxHash],
    }),
    p.foreignKey({
      name: "transporter_jobs_handover_event_fk",
      columns: [t.batchId, t.handoverTxHash],
      foreignColumns: [batchEvents.batchId, batchEvents.eventTxHash],
    }),
    p.foreignKey({
      name: "transporter_jobs_receipt_event_fk",
      columns: [t.batchId, t.receiptTxHash],
      foreignColumns: [batchEvents.batchId, batchEvents.eventTxHash],
    }),
    p.index("transporter_jobs_batch_id_idx").on(t.batchId),
    p.index("transporter_jobs_status_idx").on(t.status),
    p.index("transporter_jobs_transporter_idx").on(t.transporter),
    p.unique("transporter_jobs_listing_tx_hash_unique").on(t.listingTxHash),
    p.unique("transporter_jobs_claim_tx_hash_unique").on(t.claimTxHash),
    p.unique("transporter_jobs_handover_tx_hash_unique").on(t.handoverTxHash),
    p.unique("transporter_jobs_receipt_tx_hash_unique").on(t.receiptTxHash),
  ],
);
