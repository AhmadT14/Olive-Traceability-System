CREATE TABLE "batch_events" (
	"event_tx_hash" varchar(66) PRIMARY KEY,
	"batch_id" varchar(64) NOT NULL,
	"contract_event" varchar(32) NOT NULL,
	"details_type" varchar(40) NOT NULL,
	"payload_version" smallint DEFAULT 1 NOT NULL,
	"details" jsonb NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batch_events_batch_tx_unique" UNIQUE("batch_id","event_tx_hash"),
	CONSTRAINT "batch_events_contract_event_check" CHECK ("contract_event" IN ('BatchCreated', 'BatchListed', 'BatchClaimed', 'HandoverInitiated', 'ReceiptConfirmed')),
	CONSTRAINT "batch_events_details_type_check" CHECK ("details_type" IN ('farm', 'transporter_olive_pickup', 'transporter_oil_pickup', 'transporter_olive_delivery', 'transporter_oil_delivery', 'mill_intake', 'mill_outgoing', 'storage_intake', 'storage_outgoing', 'exporter_intake', 'exporter_outgoing', 'importer_intake', 'retailer_intake')),
	CONSTRAINT "batch_events_payload_version_check" CHECK ("payload_version" > 0),
	CONSTRAINT "batch_events_details_object_check" CHECK (jsonb_typeof("details") = 'object')
);
--> statement-breakpoint
CREATE TABLE "participant_profiles" (
	"wallet_address" varchar(42) PRIMARY KEY,
	"name" varchar(255),
	"contact_phone" varchar(64),
	"email" varchar(255),
	"address" text,
	"location" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD COLUMN "listing_tx_hash" varchar(66);--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD COLUMN "claim_tx_hash" varchar(66);--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD COLUMN "handover_tx_hash" varchar(66);--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD COLUMN "receipt_tx_hash" varchar(66);--> statement-breakpoint
ALTER TABLE "batches" ALTER COLUMN "farmer" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_listing_tx_hash_unique" UNIQUE("listing_tx_hash");--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_claim_tx_hash_unique" UNIQUE("claim_tx_hash");--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_handover_tx_hash_unique" UNIQUE("handover_tx_hash");--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_receipt_tx_hash_unique" UNIQUE("receipt_tx_hash");--> statement-breakpoint
CREATE INDEX "batch_events_batch_id_idx" ON "batch_events" ("batch_id");--> statement-breakpoint
CREATE INDEX "batch_events_details_type_idx" ON "batch_events" ("details_type");--> statement-breakpoint
ALTER TABLE "batch_events" ADD CONSTRAINT "batch_events_batch_id_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id");--> statement-breakpoint
ALTER TABLE "participant_profiles" ADD CONSTRAINT "participant_profiles_Ksw8g5D1Q0jl_fkey" FOREIGN KEY ("wallet_address") REFERENCES "participants"("wallet_address") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_listing_event_fk" FOREIGN KEY ("batch_id","listing_tx_hash") REFERENCES "batch_events"("batch_id","event_tx_hash");--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_claim_event_fk" FOREIGN KEY ("batch_id","claim_tx_hash") REFERENCES "batch_events"("batch_id","event_tx_hash");--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_handover_event_fk" FOREIGN KEY ("batch_id","handover_tx_hash") REFERENCES "batch_events"("batch_id","event_tx_hash");--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_receipt_event_fk" FOREIGN KEY ("batch_id","receipt_tx_hash") REFERENCES "batch_events"("batch_id","event_tx_hash");