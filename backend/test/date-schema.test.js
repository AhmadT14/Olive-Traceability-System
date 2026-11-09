import test from "node:test";
import assert from "node:assert/strict";
import { createBatchSchema } from "../src/validation/batch.schemas.js";
import { dateSchema } from "../src/validation/common.schemas.js";
import {
  millListingSchema,
  storageListingSchema,
} from "../src/validation/listing.schemas.js";
import { receiptSchemas } from "../src/validation/receipt.schemas.js";

test("dateSchema accepts real YYYY-MM-DD dates only", () => {
  for (const good of ["2026-10-01", "2024-02-29", "1999-12-31"]) {
    assert.equal(dateSchema.parse(good), good);
  }
  for (const bad of [
    "2026-1-01",
    "01/10/2026",
    "2026-10-01T00:00:00Z",
    " 2026-10-01",
    "2026-02-30",
    "2025-02-29",
    "2026-13-01",
    "",
    20261001,
  ]) {
    assert.equal(dateSchema.safeParse(bad).success, false, String(bad));
  }
});

test("every hashed date field uses the date format", () => {
  const farm = {
    txHash: `0x${"a".repeat(64)}`,
    batchId: "B1",
    location: "Nablus",
    olive_type: "Nabali",
  };
  assert.ok(
    createBatchSchema.safeParse({ ...farm, harvest_date: "2026-10-01" })
      .success,
  );
  assert.equal(
    createBatchSchema.safeParse({ ...farm, harvest_date: "1 Oct 2026" })
      .success,
    false,
  );

  const listing = {
    batchId: "B1",
    destinationAddress: `0x${"1".repeat(40)}`,
  };
  assert.equal(
    millListingSchema.safeParse({ ...listing, pressing_date: "2026/10/02" })
      .success,
    false,
  );
  assert.ok(millListingSchema.safeParse(listing).success);
  assert.equal(
    storageListingSchema.safeParse({ ...listing, storage_end_date: "soon" })
      .success,
    false,
  );

  const storageReceipt = receiptSchemas.Storage.schema;
  const receipt = { txHash: `0x${"b".repeat(64)}` };
  assert.ok(
    storageReceipt.safeParse({ ...receipt, storage_start_date: "2026-10-03" })
      .success,
  );
  assert.equal(
    storageReceipt.safeParse({ ...receipt, storage_start_date: "03-10-2026" })
      .success,
    false,
  );
});
