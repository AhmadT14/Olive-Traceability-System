DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "batch_events"
    GROUP BY lower("event_tx_hash")
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'batch_events has transaction hashes that differ only by letter case; resolve them by hand before running this migration';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "transporter_jobs" DROP CONSTRAINT "transporter_jobs_listing_event_fk";--> statement-breakpoint
ALTER TABLE "transporter_jobs" DROP CONSTRAINT "transporter_jobs_claim_event_fk";--> statement-breakpoint
ALTER TABLE "transporter_jobs" DROP CONSTRAINT "transporter_jobs_handover_event_fk";--> statement-breakpoint
ALTER TABLE "transporter_jobs" DROP CONSTRAINT "transporter_jobs_receipt_event_fk";--> statement-breakpoint
UPDATE "batch_events"
SET "event_tx_hash" = lower("event_tx_hash")
WHERE "event_tx_hash" <> lower("event_tx_hash");--> statement-breakpoint
UPDATE "transporter_jobs"
SET
  "listing_tx_hash" = lower("listing_tx_hash"),
  "claim_tx_hash" = lower("claim_tx_hash"),
  "handover_tx_hash" = lower("handover_tx_hash"),
  "receipt_tx_hash" = lower("receipt_tx_hash");--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_listing_event_fk" FOREIGN KEY ("batch_id","listing_tx_hash") REFERENCES "batch_events"("batch_id","event_tx_hash");--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_claim_event_fk" FOREIGN KEY ("batch_id","claim_tx_hash") REFERENCES "batch_events"("batch_id","event_tx_hash");--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_handover_event_fk" FOREIGN KEY ("batch_id","handover_tx_hash") REFERENCES "batch_events"("batch_id","event_tx_hash");--> statement-breakpoint
ALTER TABLE "transporter_jobs" ADD CONSTRAINT "transporter_jobs_receipt_event_fk" FOREIGN KEY ("batch_id","receipt_tx_hash") REFERENCES "batch_events"("batch_id","event_tx_hash");
