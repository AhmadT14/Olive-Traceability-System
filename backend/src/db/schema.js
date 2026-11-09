import * as p from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const wallet = (name) => p.varchar(name, { length: 42 });
const txHash = (name) => p.varchar(name, { length: 66 });

export const participants = p.pgTable("participants", {
  walletAddress: wallet("wallet_address").primaryKey(),
});

export const batches = p.pgTable("batches", {
  batchId: p.varchar("batch_id", { length: 64 }).primaryKey(),
  createdAt: p.timestamp("created_at").defaultNow(),
});

export const batchEvents = p.pgTable(
  "batch_events",
  {
    eventTxHash: txHash("event_tx_hash").primaryKey(),
    batchId: p
      .varchar("batch_id", { length: 64 })
      .notNull()
      .references(() => batches.batchId),
    contractEvent: p.varchar("contract_event", { length: 32 }).notNull(),
    detailsType: p.varchar("details_type", { length: 40 }).notNull(),
    payloadVersion: p.smallint("payload_version").notNull().default(1),
    details: p.jsonb("details").notNull(),
    recordedAt: p
      .timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    p.check(
      "batch_events_details_object_check",
      sql`jsonb_typeof(${t.details}) = 'object'`,
    ),
    p.unique("batch_events_batch_tx_unique").on(t.batchId, t.eventTxHash),
    p.index("batch_events_batch_id_idx").on(t.batchId),
    p.index("batch_events_details_type_idx").on(t.detailsType),
  ],
);

export const participantProfiles = p.pgTable("participant_profiles", {
  walletAddress: wallet("wallet_address")
    .primaryKey()
    .references(() => participants.walletAddress, { onDelete: "cascade" }),
  name: p.varchar("name", { length: 255 }),
  contactPhone: p.varchar("contact_phone", { length: 64 }),
  email: p.varchar("email", { length: 255 }),
  address: p.text("address"),
  location: p.varchar("location", { length: 255 }),
  availability: p.varchar("availability", { length: 32 }),
  details: p.jsonb("details").notNull().default({}),
});

const batchRef = () =>
  p
    .varchar("batch_id", { length: 64 })
    .notNull()
    .references(() => batches.batchId);

export const transporterJobs = p.pgTable(
  "transporter_jobs",
  {
    id: p.integer("id").primaryKey().generatedAlwaysAsIdentity(),
    batchId: batchRef(),
    sourceParty: wallet("source_party")
      .notNull()
      .references(() => participants.walletAddress),
    destinationParty: wallet("destination_party")
      .notNull()
      .references(() => participants.walletAddress),
    transporter: wallet("transporter").references(
      () => participants.walletAddress,
    ),
    status: p.varchar("status", { length: 32 }).notNull(),
    listingTxHash: txHash("listing_tx_hash"),
    claimTxHash: txHash("claim_tx_hash"),
    handoverTxHash: txHash("handover_tx_hash"),
    receiptTxHash: txHash("receipt_tx_hash"),
    reserveTxHash: txHash("reserve_tx_hash"),
    reservedAt: p.timestamp("reserved_at", { withTimezone: true }),
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
    p.unique("transporter_jobs_reserve_tx_hash_unique").on(t.reserveTxHash),
  ],
);

const ROLE_NAMES = [
  "FARMER",
  "TRANSPORTER",
  "MILL",
  "STORAGE",
  "EXPORTER",
  "IMPORTER",
  "RETAILER",
];
const RECORD_TYPES = [
  "farm",
  "transporter_olive_pickup",
  "transporter_oil_pickup",
  "transporter_olive_delivery",
  "transporter_oil_delivery",
  "mill_intake",
  "mill_outgoing",
  "storage_intake",
  "storage_outgoing",
  "exporter_intake",
  "exporter_outgoing",
  "importer_intake",
  "importer_outgoing",
  "retailer_intake",
];
const oneOf = (column, values) =>
  sql`${column} IN (${sql.raw(values.map((v) => `'${v}'`).join(", "))})`;

export const registrationApplications = p.pgTable(
  "registration_applications",
  {
    id: p.integer("id").primaryKey().generatedAlwaysAsIdentity(),
    walletAddress: wallet("wallet_address").notNull(),
    role: p.varchar("role", { length: 32 }).notNull(),
    status: p.varchar("status", { length: 16 }).notNull().default("pending"),
    profile: p.jsonb("profile").notNull(),
    rejectionReason: p.text("rejection_reason"),
    reviewedBy: wallet("reviewed_by"),
    createdAt: p
      .timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: p.timestamp("reviewed_at", { withTimezone: true }),
  },
  (t) => [
    p.check("registration_applications_role_check", oneOf(t.role, ROLE_NAMES)),
    p.check(
      "registration_applications_status_check",
      oneOf(t.status, ["pending", "approved", "rejected"]),
    ),
    p.check(
      "registration_applications_profile_object_check",
      sql`jsonb_typeof(${t.profile}) = 'object'`,
    ),
    p
      .uniqueIndex("registration_applications_one_pending_idx")
      .on(t.walletAddress)
      .where(sql`${t.status} = 'pending'`),
    p.index("registration_applications_status_idx").on(t.status),
  ],
);

export const pendingSaves = p.pgTable(
  "pending_saves",
  {
    id: p.integer("id").primaryKey().generatedAlwaysAsIdentity(),
    walletAddress: wallet("wallet_address").notNull(),
    batchId: p.varchar("batch_id", { length: 64 }).notNull(),
    detailsType: p.varchar("details_type", { length: 40 }).notNull(),
    payload: p.jsonb("payload").notNull(),
    dataHash: txHash("data_hash").notNull(),
    txHash: txHash("tx_hash"),
    status: p.varchar("status", { length: 16 }).notNull().default("pending"),
    failureReason: p.text("failure_reason"),
    createdAt: p
      .timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: p.timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    p.check(
      "pending_saves_details_type_check",
      oneOf(t.detailsType, RECORD_TYPES),
    ),
    p.check(
      "pending_saves_status_check",
      oneOf(t.status, ["pending", "confirmed", "failed"]),
    ),
    p.check(
      "pending_saves_payload_object_check",
      sql`jsonb_typeof(${t.payload}) = 'object'`,
    ),
    p.unique("pending_saves_tx_hash_unique").on(t.txHash),
    p.index("pending_saves_batch_hash_idx").on(t.batchId, t.dataHash),
    p.index("pending_saves_status_idx").on(t.status),
    p.index("pending_saves_wallet_idx").on(t.walletAddress),
  ],
);

export const chainEvents = p.pgTable(
  "chain_events",
  {
    id: p
      .bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    contractAddress: wallet("contract_address").notNull(),
    eventName: p.varchar("event_name", { length: 40 }).notNull(),
    txHash: txHash("tx_hash").notNull(),
    logIndex: p.integer("log_index").notNull(),
    blockNumber: p.bigint("block_number", { mode: "number" }).notNull(),
    blockTime: p.timestamp("block_time", { withTimezone: true }),
    batchTopic: txHash("batch_topic"),
    addresses: p
      .varchar("addresses", { length: 42 })
      .array()
      .notNull()
      .default(sql`'{}'`),
    args: p.jsonb("args").notNull(),
  },
  (t) => [
    p.unique("chain_events_tx_log_unique").on(t.txHash, t.logIndex),
    p.check(
      "chain_events_args_object_check",
      sql`jsonb_typeof(${t.args}) = 'object'`,
    ),
    p.index("chain_events_batch_topic_idx").on(t.batchTopic),
    p.index("chain_events_event_name_idx").on(t.eventName),
    p.index("chain_events_block_idx").on(t.blockNumber, t.logIndex),
    p.index("chain_events_addresses_idx").using("gin", t.addresses),
  ],
);

export const chainSyncState = p.pgTable("chain_sync_state", {
  name: p.varchar("name", { length: 32 }).primaryKey(),
  lastBlock: p.bigint("last_block", { mode: "number" }).notNull(),
  updatedAt: p
    .timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
