CREATE TABLE "batches" (
	"batch_id" varchar(64) PRIMARY KEY,
	"farmer" varchar(42) NOT NULL,
	"harvest_date" date,
	"location" varchar(255),
	"olive_type" varchar(128),
	"create_tx_hash" varchar(66),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "export_records" (
	"event_tx_hash" varchar(66) PRIMARY KEY,
	"batch_id" varchar(64) NOT NULL,
	"quantity_shipped" numeric,
	"shipment_prep" text,
	"export_date" date,
	"destination" varchar(255),
	"product_condition" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "exporter_details" (
	"wallet_address" varchar(42) PRIMARY KEY,
	"company_name" varchar(255),
	"contact_phone" varchar(64),
	"email" varchar(255),
	"address" text,
	"location" varchar(255),
	"export_license_details" text,
	"destination_markets" text
);
--> statement-breakpoint
CREATE TABLE "farm_records" (
	"event_tx_hash" varchar(66) PRIMARY KEY,
	"batch_id" varchar(64) NOT NULL,
	"quantity" numeric,
	"cultivation_method" varchar(255),
	"irrigation_method" varchar(255),
	"fertilizer_details" text,
	"pesticide_details" text,
	"harvesting_method" varchar(255),
	"quality_details" text,
	"farm_notes" text
);
--> statement-breakpoint
CREATE TABLE "farmer_details" (
	"wallet_address" varchar(42) PRIMARY KEY,
	"farm_name" varchar(255),
	"contact_phone" varchar(64),
	"email" varchar(255),
	"address" text,
	"location" varchar(255),
	"certification_details" text
);
--> statement-breakpoint
CREATE TABLE "import_records" (
	"event_tx_hash" varchar(66) PRIMARY KEY,
	"batch_id" varchar(64) NOT NULL,
	"quantity_received" numeric,
	"shipment_arrival_details" text,
	"received_product_details" text,
	"product_condition" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "importer_details" (
	"wallet_address" varchar(42) PRIMARY KEY,
	"business_name" varchar(255),
	"contact_phone" varchar(64),
	"email" varchar(255),
	"address" text,
	"location" varchar(255),
	"import_license_details" text,
	"distribution_details" text
);
--> statement-breakpoint
CREATE TABLE "mill_bottler_details" (
	"wallet_address" varchar(42) PRIMARY KEY,
	"facility_name" varchar(255),
	"contact_phone" varchar(64),
	"email" varchar(255),
	"address" text,
	"location" varchar(255),
	"processing_capacity" numeric,
	"certification_details" text
);
--> statement-breakpoint
CREATE TABLE "mill_oil_records" (
	"event_tx_hash" varchar(66) PRIMARY KEY,
	"batch_id" varchar(64) NOT NULL,
	"pressing_date" date,
	"extraction_method" varchar(255),
	"output_quantity" numeric,
	"oil_quality" text,
	"packaging_details" text,
	"qr_code_reference" varchar(255),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "mill_olive_records" (
	"event_tx_hash" varchar(66) PRIMARY KEY,
	"batch_id" varchar(64) NOT NULL,
	"arrival_condition" text,
	"quantity_received" numeric,
	"olive_quality" text,
	"storage_condition" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"wallet_address" varchar(42) PRIMARY KEY,
	"name" varchar(255),
	"role" varchar(32),
	"status" varchar(32),
	"availability" varchar(32),
	"registered_at" timestamp,
	"approved_by" varchar(42),
	"approved_at" timestamp,
	"register_tx_hash" varchar(66)
);
--> statement-breakpoint
CREATE TABLE "retail_records" (
	"event_tx_hash" varchar(66) PRIMARY KEY,
	"batch_id" varchar(64) NOT NULL,
	"quantity_received" numeric,
	"final_receipt_details" text,
	"product_condition" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "retailer_details" (
	"wallet_address" varchar(42) PRIMARY KEY,
	"business_name" varchar(255),
	"contact_phone" varchar(64),
	"email" varchar(255),
	"address" text,
	"location" varchar(255),
	"retail_license_details" text,
	"business_type" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "storage_details" (
	"wallet_address" varchar(42) PRIMARY KEY,
	"facility_name" varchar(255),
	"contact_phone" varchar(64),
	"email" varchar(255),
	"address" text,
	"location" varchar(255),
	"storage_capacity" numeric,
	"storage_conditions" text,
	"certification_details" text
);
--> statement-breakpoint
CREATE TABLE "storage_records" (
	"event_tx_hash" varchar(66) PRIMARY KEY,
	"batch_id" varchar(64) NOT NULL,
	"quantity_received" numeric,
	"storage_start_date" date,
	"expected_duration" integer,
	"conditions" text,
	"product_condition" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "transporter_details" (
	"wallet_address" varchar(42) PRIMARY KEY,
	"company_name" varchar(255),
	"contact_phone" varchar(64),
	"email" varchar(255),
	"address" text,
	"location" varchar(255),
	"vehicle_details" text,
	"license_details" text
);
--> statement-breakpoint
CREATE TABLE "transporter_jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transporter_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"batch_id" varchar(64) NOT NULL,
	"source_party" varchar(42) NOT NULL,
	"destination_party" varchar(42) NOT NULL,
	"transporter" varchar(42),
	"status" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transporter_oil_records" (
	"event_tx_hash" varchar(66) PRIMARY KEY,
	"batch_id" varchar(64) NOT NULL,
	"truck_details" varchar(255),
	"quantity_picked_up" numeric,
	"quantity_delivered" numeric,
	"oil_condition" text,
	"packaging_condition" text,
	"loading_details" text,
	"unloading_details" text,
	"transport_conditions" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "transporter_olive_records" (
	"event_tx_hash" varchar(66) PRIMARY KEY,
	"batch_id" varchar(64) NOT NULL,
	"truck_details" varchar(255),
	"quantity_picked_up" numeric,
	"quantity_delivered" numeric,
	"pickup_condition" text,
	"olive_condition" text,
	"loading_details" text,
	"unloading_details" text,
	"transport_conditions" text,
	"notes" text
);
--> statement-breakpoint
CREATE INDEX "batches_farmer_idx" ON "batches" ("farmer");--> statement-breakpoint
CREATE INDEX "export_records_batch_id_idx" ON "export_records" ("batch_id");--> statement-breakpoint
CREATE INDEX "farm_records_batch_id_idx" ON "farm_records" ("batch_id");--> statement-breakpoint
CREATE INDEX "import_records_batch_id_idx" ON "import_records" ("batch_id");--> statement-breakpoint
CREATE INDEX "mill_oil_records_batch_id_idx" ON "mill_oil_records" ("batch_id");--> statement-breakpoint
CREATE INDEX "mill_olive_records_batch_id_idx" ON "mill_olive_records" ("batch_id");--> statement-breakpoint
CREATE INDEX "retail_records_batch_id_idx" ON "retail_records" ("batch_id");--> statement-breakpoint
CREATE INDEX "storage_records_batch_id_idx" ON "storage_records" ("batch_id");--> statement-breakpoint
CREATE INDEX "transporter_jobs_batch_id_idx" ON "transporter_jobs" ("batch_id");--> statement-breakpoint
CREATE INDEX "transporter_jobs_status_idx" ON "transporter_jobs" ("status");--> statement-breakpoint
CREATE INDEX "transporter_jobs_transporter_idx" ON "transporter_jobs" ("transporter");--> statement-breakpoint
CREATE INDEX "transporter_oil_records_batch_id_idx" ON "transporter_oil_records" ("batch_id");--> statement-breakpoint
CREATE INDEX "transporter_olive_records_batch_id_idx" ON "transporter_olive_records" ("batch_id");--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_farmer_participants_wallet_address_fkey" FOREIGN KEY ("farmer") REFERENCES "participants"("wallet_address");--> statement-breakpoint
ALTER TABLE "export_records" ADD CONSTRAINT "export_records_batch_id_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id");--> statement-breakpoint
ALTER TABLE "exporter_details" ADD CONSTRAINT "exporter_details_iFvZOo9wZaTB_fkey" FOREIGN KEY ("wallet_address") REFERENCES "participants"("wallet_address") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "farm_records" ADD CONSTRAINT "farm_records_batch_id_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id");--> statement-breakpoint
ALTER TABLE "farmer_details" ADD CONSTRAINT "farmer_details_wallet_address_participants_wallet_address_fkey" FOREIGN KEY ("wallet_address") REFERENCES "participants"("wallet_address") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "import_records" ADD CONSTRAINT "import_records_batch_id_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id");--> statement-breakpoint
ALTER TABLE "importer_details" ADD CONSTRAINT "importer_details_iFvZOo9wZaKg_fkey" FOREIGN KEY ("wallet_address") REFERENCES "participants"("wallet_address") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mill_bottler_details" ADD CONSTRAINT "mill_bottler_details_O6TDAUXcOJxB_fkey" FOREIGN KEY ("wallet_address") REFERENCES "participants"("wallet_address") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mill_oil_records" ADD CONSTRAINT "mill_oil_records_batch_id_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id");--> statement-breakpoint
ALTER TABLE "mill_olive_records" ADD CONSTRAINT "mill_olive_records_batch_id_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id");--> statement-breakpoint
ALTER TABLE "retail_records" ADD CONSTRAINT "retail_records_batch_id_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id");--> statement-breakpoint
ALTER TABLE "retailer_details" ADD CONSTRAINT "retailer_details_iFvZOo5NCRge_fkey" FOREIGN KEY ("wallet_address") REFERENCES "participants"("wallet_address") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "storage_details" ADD CONSTRAINT "storage_details_wallet_address_participants_wallet_address_fkey" FOREIGN KEY ("wallet_address") REFERENCES "participants"("wallet_address") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "storage_records" ADD CONSTRAINT "storage_records_batch_id_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id");--> statement-breakpoint
ALTER TABLE "transporter_details" ADD CONSTRAINT "transporter_details_g9ukyYK1dUZ4_fkey" FOREIGN KEY ("wallet_address") REFERENCES "participants"("wallet_address") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_batch_id_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id");--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_source_party_participants_wallet_address_fkey" FOREIGN KEY ("source_party") REFERENCES "participants"("wallet_address");--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_SBT76rscwi4R_fkey" FOREIGN KEY ("destination_party") REFERENCES "participants"("wallet_address");--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_transporter_participants_wallet_address_fkey" FOREIGN KEY ("transporter") REFERENCES "participants"("wallet_address");--> statement-breakpoint
ALTER TABLE "transporter_oil_records" ADD CONSTRAINT "transporter_oil_records_batch_id_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id");--> statement-breakpoint
ALTER TABLE "transporter_olive_records" ADD CONSTRAINT "transporter_olive_records_batch_id_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id");