ALTER TABLE "participant_profiles"
ADD COLUMN "details" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "participant_profiles"
ADD CONSTRAINT "participant_profiles_details_object_check"
CHECK (jsonb_typeof("details") = 'object');
--> statement-breakpoint
ALTER TABLE "batch_events"
DROP CONSTRAINT IF EXISTS "batch_events_details_type_check";
--> statement-breakpoint
ALTER TABLE "batch_events"
ADD CONSTRAINT "batch_events_details_type_check"
CHECK ("details_type" IN (
  'farm',
  'transporter_olive_pickup',
  'transporter_oil_pickup',
  'transporter_olive_delivery',
  'transporter_oil_delivery',
  'mill_intake',
  'mill_outgoing',
  'storage_intake',
  'storage_outgoing',
  'exporter_intake',
  'exporter_outgoing',
  'importer_intake',
  'importer_outgoing',
  'retailer_intake'
));
--> statement-breakpoint
DROP TABLE IF EXISTS "farm_records", "transporter_olive_records", "transporter_oil_records",
  "mill_olive_records", "mill_oil_records", "storage_records", "export_records",
  "import_records", "retail_records", "farmer_details", "transporter_details",
  "mill_bottler_details", "storage_details", "exporter_details", "importer_details",
  "retailer_details" CASCADE;
