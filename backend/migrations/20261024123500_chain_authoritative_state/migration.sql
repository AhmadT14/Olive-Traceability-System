ALTER TABLE "participant_profiles"
ADD COLUMN IF NOT EXISTS "availability" varchar(32);
--> statement-breakpoint
UPDATE "participant_profiles" AS profiles
SET "name" = COALESCE(profiles."name", participants."name")
FROM "participants"
WHERE profiles."wallet_address" = participants."wallet_address"
  AND participants."name" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "participants"
DROP COLUMN IF EXISTS "name",
DROP COLUMN IF EXISTS "role",
DROP COLUMN IF EXISTS "status",
DROP COLUMN IF EXISTS "registered_at",
DROP COLUMN IF EXISTS "approved_by",
DROP COLUMN IF EXISTS "approved_at",
DROP COLUMN IF EXISTS "register_tx_hash";
--> statement-breakpoint
ALTER TABLE "batches"
DROP COLUMN IF EXISTS "farmer",
DROP COLUMN IF EXISTS "harvest_date",
DROP COLUMN IF EXISTS "location",
DROP COLUMN IF EXISTS "olive_type",
DROP COLUMN IF EXISTS "create_tx_hash";
