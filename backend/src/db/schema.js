import * as p from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Conventions (see reference doc, section 7):
// - wallet addresses are stored lowercase, 42 chars (0x + 40 hex)
// - tx hashes are 66 chars (0x + 64 hex)
// - every event table is keyed by its own chain-derived event_tx_hash
// - no data_hash column anywhere: verification recomputes it from the row
// - foreign keys are enforced in the database (not only in code)

const wallet = (name) => p.varchar(name, { length: 42 });
const txHash = (name) => p.varchar(name, { length: 66 });

// ───────────────────────── participants ─────────────────────────

export const participants = p.pgTable("participants", {
  walletAddress: wallet("wallet_address").primaryKey(),
  name: p.varchar("name", { length: 255 }),
  role: p.varchar("role", { length: 32 }),
  status: p.varchar("status", { length: 32 }), // pending | approved | revoked
  availability: p.varchar("availability", { length: 32 }),
  registeredAt: p.timestamp("registered_at"),
  approvedBy: wallet("approved_by"),
  approvedAt: p.timestamp("approved_at"),
  registerTxHash: txHash("register_tx_hash"),
});

// ───────────────────────── batches ─────────────────────────

export const batches = p.pgTable(
  "batches",
  {
    batchId: p.varchar("batch_id", { length: 64 }).primaryKey(),
    // Legacy nullable column retained until the old tables are retired.
    farmer: wallet("farmer").references(() => participants.walletAddress),
    harvestDate: p.date("harvest_date"),
    location: p.varchar("location", { length: 255 }),
    oliveType: p.varchar("olive_type", { length: 128 }),
    createTxHash: txHash("create_tx_hash"),
    createdAt: p.timestamp("created_at").defaultNow(),
  },
  (t) => [p.index("batches_farmer_idx").on(t.farmer)],
);

// New event store. contract_event and details_type identify which strict
// application schema validates details; chain state and data hashes are not
// stored here. Legacy event tables remain during the route migration.
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
    recordedAt: p.timestamp("recorded_at", { withTimezone: true })
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
      sql`${t.detailsType} IN ('farm', 'transporter_olive_pickup', 'transporter_oil_pickup', 'transporter_olive_delivery', 'transporter_oil_delivery', 'mill_intake', 'mill_outgoing', 'storage_intake', 'storage_outgoing', 'exporter_intake', 'exporter_outgoing', 'importer_intake', 'retailer_intake')`,
    ),
    p.check(
      "batch_events_payload_version_check",
      sql`${t.payloadVersion} > 0`,
    ),
    p.check(
      "batch_events_details_object_check",
      sql`jsonb_typeof(${t.details}) = 'object'`,
    ),
    p.unique("batch_events_batch_tx_unique").on(t.batchId, t.eventTxHash),
    p.index("batch_events_batch_id_idx").on(t.batchId),
    p.index("batch_events_details_type_idx").on(t.detailsType),
  ],
);

// Common participant contact information is separated from role-specific
// profiles. Kept nullable during migration so existing users can be backfilled.
export const participantProfiles = p.pgTable("participant_profiles", {
  walletAddress: wallet("wallet_address")
    .primaryKey()
    .references(() => participants.walletAddress, { onDelete: "cascade" }),
  name: p.varchar("name", { length: 255 }),
  contactPhone: p.varchar("contact_phone", { length: 64 }),
  email: p.varchar("email", { length: 255 }),
  address: p.text("address"),
  location: p.varchar("location", { length: 255 }),
});

const batchRef = () =>
  p
    .varchar("batch_id", { length: 64 })
    .notNull()
    .references(() => batches.batchId);

// ───────────────────────── transporter_jobs (pre-chain) ─────────────────────────

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
    status: p.varchar("status", { length: 32 }).notNull(), // available | claimed | ...
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

// ───────────────────────── event records ─────────────────────────

export const farmRecords = p.pgTable(
  "farm_records",
  {
    eventTxHash: txHash("event_tx_hash").primaryKey(),
    batchId: batchRef(),
    quantity: p.numeric("quantity"),
    cultivationMethod: p.varchar("cultivation_method", { length: 255 }),
    irrigationMethod: p.varchar("irrigation_method", { length: 255 }),
    fertilizerDetails: p.text("fertilizer_details"),
    pesticideDetails: p.text("pesticide_details"),
    harvestingMethod: p.varchar("harvesting_method", { length: 255 }),
    qualityDetails: p.text("quality_details"),
    farmNotes: p.text("farm_notes"),
  },
  (t) => [p.index("farm_records_batch_id_idx").on(t.batchId)],
);

export const transporterOliveRecords = p.pgTable(
  "transporter_olive_records",
  {
    eventTxHash: txHash("event_tx_hash").primaryKey(),
    batchId: batchRef(),
    truckDetails: p.varchar("truck_details", { length: 255 }),
    quantityPickedUp: p.numeric("quantity_picked_up"),
    quantityDelivered: p.numeric("quantity_delivered"),
    pickupCondition: p.text("pickup_condition"),
    oliveCondition: p.text("olive_condition"),
    loadingDetails: p.text("loading_details"),
    unloadingDetails: p.text("unloading_details"),
    transportConditions: p.text("transport_conditions"),
    notes: p.text("notes"),
  },
  (t) => [p.index("transporter_olive_records_batch_id_idx").on(t.batchId)],
);

export const transporterOilRecords = p.pgTable(
  "transporter_oil_records",
  {
    eventTxHash: txHash("event_tx_hash").primaryKey(),
    batchId: batchRef(),
    truckDetails: p.varchar("truck_details", { length: 255 }),
    quantityPickedUp: p.numeric("quantity_picked_up"),
    quantityDelivered: p.numeric("quantity_delivered"),
    oilCondition: p.text("oil_condition"),
    packagingCondition: p.text("packaging_condition"),
    loadingDetails: p.text("loading_details"),
    unloadingDetails: p.text("unloading_details"),
    transportConditions: p.text("transport_conditions"),
    notes: p.text("notes"),
  },
  (t) => [p.index("transporter_oil_records_batch_id_idx").on(t.batchId)],
);

export const millOliveRecords = p.pgTable(
  "mill_olive_records",
  {
    eventTxHash: txHash("event_tx_hash").primaryKey(),
    batchId: batchRef(),
    arrivalCondition: p.text("arrival_condition"),
    quantityReceived: p.numeric("quantity_received"),
    oliveQuality: p.text("olive_quality"),
    storageCondition: p.text("storage_condition"),
    notes: p.text("notes"),
  },
  (t) => [p.index("mill_olive_records_batch_id_idx").on(t.batchId)],
);

export const millOilRecords = p.pgTable(
  "mill_oil_records",
  {
    eventTxHash: txHash("event_tx_hash").primaryKey(),
    batchId: batchRef(),
    pressingDate: p.date("pressing_date"),
    extractionMethod: p.varchar("extraction_method", { length: 255 }),
    outputQuantity: p.numeric("output_quantity"),
    oilQuality: p.text("oil_quality"),
    packagingDetails: p.text("packaging_details"),
    qrCodeReference: p.varchar("qr_code_reference", { length: 255 }),
    notes: p.text("notes"),
  },
  (t) => [p.index("mill_oil_records_batch_id_idx").on(t.batchId)],
);

export const storageRecords = p.pgTable(
  "storage_records",
  {
    eventTxHash: txHash("event_tx_hash").primaryKey(),
    batchId: batchRef(),
    quantityReceived: p.numeric("quantity_received"),
    storageStartDate: p.date("storage_start_date"),
    expectedDuration: p.integer("expected_duration"),
    conditions: p.text("conditions"),
    productCondition: p.text("product_condition"),
    notes: p.text("notes"),
  },
  (t) => [p.index("storage_records_batch_id_idx").on(t.batchId)],
);

export const exportRecords = p.pgTable(
  "export_records",
  {
    eventTxHash: txHash("event_tx_hash").primaryKey(),
    batchId: batchRef(),
    quantityShipped: p.numeric("quantity_shipped"),
    shipmentPrep: p.text("shipment_prep"),
    exportDate: p.date("export_date"),
    destination: p.varchar("destination", { length: 255 }),
    productCondition: p.text("product_condition"),
    notes: p.text("notes"),
  },
  (t) => [p.index("export_records_batch_id_idx").on(t.batchId)],
);

export const importRecords = p.pgTable(
  "import_records",
  {
    eventTxHash: txHash("event_tx_hash").primaryKey(),
    batchId: batchRef(),
    quantityReceived: p.numeric("quantity_received"),
    shipmentArrivalDetails: p.text("shipment_arrival_details"),
    receivedProductDetails: p.text("received_product_details"),
    productCondition: p.text("product_condition"),
    notes: p.text("notes"),
  },
  (t) => [p.index("import_records_batch_id_idx").on(t.batchId)],
);

export const retailRecords = p.pgTable(
  "retail_records",
  {
    eventTxHash: txHash("event_tx_hash").primaryKey(),
    batchId: batchRef(),
    quantityReceived: p.numeric("quantity_received"),
    finalReceiptDetails: p.text("final_receipt_details"),
    productCondition: p.text("product_condition"),
    notes: p.text("notes"),
  },
  (t) => [p.index("retail_records_batch_id_idx").on(t.batchId)],
);

// ───────────────────────── per-role details (1:1 with participants) ─────────────────────────

const detailsKey = () =>
  wallet("wallet_address")
    .primaryKey()
    .references(() => participants.walletAddress, { onDelete: "cascade" });

export const farmerDetails = p.pgTable("farmer_details", {
  walletAddress: detailsKey(),
  farmName: p.varchar("farm_name", { length: 255 }),
  contactPhone: p.varchar("contact_phone", { length: 64 }),
  email: p.varchar("email", { length: 255 }),
  address: p.text("address"),
  location: p.varchar("location", { length: 255 }),
  certificationDetails: p.text("certification_details"),
});

export const transporterDetails = p.pgTable("transporter_details", {
  walletAddress: detailsKey(),
  companyName: p.varchar("company_name", { length: 255 }),
  contactPhone: p.varchar("contact_phone", { length: 64 }),
  email: p.varchar("email", { length: 255 }),
  address: p.text("address"),
  location: p.varchar("location", { length: 255 }),
  vehicleDetails: p.text("vehicle_details"),
  licenseDetails: p.text("license_details"),
});

export const millBottlerDetails = p.pgTable("mill_bottler_details", {
  walletAddress: detailsKey(),
  facilityName: p.varchar("facility_name", { length: 255 }),
  contactPhone: p.varchar("contact_phone", { length: 64 }),
  email: p.varchar("email", { length: 255 }),
  address: p.text("address"),
  location: p.varchar("location", { length: 255 }),
  processingCapacity: p.numeric("processing_capacity"),
  certificationDetails: p.text("certification_details"),
});

export const storageDetails = p.pgTable("storage_details", {
  walletAddress: detailsKey(),
  facilityName: p.varchar("facility_name", { length: 255 }),
  contactPhone: p.varchar("contact_phone", { length: 64 }),
  email: p.varchar("email", { length: 255 }),
  address: p.text("address"),
  location: p.varchar("location", { length: 255 }),
  storageCapacity: p.numeric("storage_capacity"),
  storageConditions: p.text("storage_conditions"),
  certificationDetails: p.text("certification_details"),
});

export const exporterDetails = p.pgTable("exporter_details", {
  walletAddress: detailsKey(),
  companyName: p.varchar("company_name", { length: 255 }),
  contactPhone: p.varchar("contact_phone", { length: 64 }),
  email: p.varchar("email", { length: 255 }),
  address: p.text("address"),
  location: p.varchar("location", { length: 255 }),
  exportLicenseDetails: p.text("export_license_details"),
  destinationMarkets: p.text("destination_markets"),
});

export const importerDetails = p.pgTable("importer_details", {
  walletAddress: detailsKey(),
  businessName: p.varchar("business_name", { length: 255 }),
  contactPhone: p.varchar("contact_phone", { length: 64 }),
  email: p.varchar("email", { length: 255 }),
  address: p.text("address"),
  location: p.varchar("location", { length: 255 }),
  importLicenseDetails: p.text("import_license_details"),
  distributionDetails: p.text("distribution_details"),
});

export const retailerDetails = p.pgTable("retailer_details", {
  walletAddress: detailsKey(),
  businessName: p.varchar("business_name", { length: 255 }),
  contactPhone: p.varchar("contact_phone", { length: 64 }),
  email: p.varchar("email", { length: 255 }),
  address: p.text("address"),
  location: p.varchar("location", { length: 255 }),
  retailLicenseDetails: p.text("retail_license_details"),
  businessType: p.varchar("business_type", { length: 128 }),
});
