CREATE TABLE "chain_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chain_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"contract_address" varchar(42) NOT NULL,
	"event_name" varchar(40) NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" bigint NOT NULL,
	"block_time" timestamp with time zone,
	"batch_topic" varchar(66),
	"addresses" varchar(42)[] DEFAULT '{}'::varchar(42)[] NOT NULL,
	"args" jsonb NOT NULL,
	CONSTRAINT "chain_events_tx_log_unique" UNIQUE("tx_hash","log_index"),
	CONSTRAINT "chain_events_args_object_check" CHECK (jsonb_typeof("args") = 'object')
);
--> statement-breakpoint
CREATE TABLE "chain_sync_state" (
	"name" varchar(32) PRIMARY KEY,
	"last_block" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_saves" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pending_saves_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"wallet_address" varchar(42) NOT NULL,
	"batch_id" varchar(64) NOT NULL,
	"details_type" varchar(40) NOT NULL,
	"payload" jsonb NOT NULL,
	"data_hash" varchar(66) NOT NULL,
	"tx_hash" varchar(66) CONSTRAINT "pending_saves_tx_hash_unique" UNIQUE,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "pending_saves_details_type_check" CHECK ("details_type" IN ('farm', 'transporter_olive_pickup', 'transporter_oil_pickup', 'transporter_olive_delivery', 'transporter_oil_delivery', 'mill_intake', 'mill_outgoing', 'storage_intake', 'storage_outgoing', 'exporter_intake', 'exporter_outgoing', 'importer_intake', 'importer_outgoing', 'retailer_intake')),
	CONSTRAINT "pending_saves_status_check" CHECK ("status" IN ('pending', 'confirmed', 'failed')),
	CONSTRAINT "pending_saves_payload_object_check" CHECK (jsonb_typeof("payload") = 'object')
);
--> statement-breakpoint
CREATE TABLE "registration_applications" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "registration_applications_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"wallet_address" varchar(42) NOT NULL,
	"role" varchar(32) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"profile" jsonb NOT NULL,
	"rejection_reason" text,
	"reviewed_by" varchar(42),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "registration_applications_role_check" CHECK ("role" IN ('FARMER', 'TRANSPORTER', 'MILL', 'STORAGE', 'EXPORTER', 'IMPORTER', 'RETAILER')),
	CONSTRAINT "registration_applications_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected')),
	CONSTRAINT "registration_applications_profile_object_check" CHECK (jsonb_typeof("profile") = 'object')
);
--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD COLUMN "reserve_tx_hash" varchar(66);--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_reserve_tx_hash_unique" UNIQUE("reserve_tx_hash");--> statement-breakpoint
CREATE INDEX "chain_events_batch_topic_idx" ON "chain_events" ("batch_topic");--> statement-breakpoint
CREATE INDEX "chain_events_event_name_idx" ON "chain_events" ("event_name");--> statement-breakpoint
CREATE INDEX "chain_events_block_idx" ON "chain_events" ("block_number","log_index");--> statement-breakpoint
CREATE INDEX "chain_events_addresses_idx" ON "chain_events" USING gin ("addresses");--> statement-breakpoint
CREATE INDEX "pending_saves_batch_hash_idx" ON "pending_saves" ("batch_id","data_hash");--> statement-breakpoint
CREATE INDEX "pending_saves_status_idx" ON "pending_saves" ("status");--> statement-breakpoint
CREATE INDEX "pending_saves_wallet_idx" ON "pending_saves" ("wallet_address");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_applications_one_pending_idx" ON "registration_applications" ("wallet_address") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "registration_applications_status_idx" ON "registration_applications" ("status");