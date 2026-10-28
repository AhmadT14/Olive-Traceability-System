import test from "node:test";
import assert from "node:assert/strict";
import { keccak256, toUtf8Bytes } from "ethers";
import { HASH_FIELDS } from "../src/hashing/fields.js";
import { computeDataHash, normalize } from "../src/hashing/hash.js";

test("normalize handles empty values and trimmed strings", () => {
  assert.equal(normalize("notes", undefined), null);
  assert.equal(normalize("notes", null), null);
  assert.equal(
    normalize("notes", "  harvested by hand  "),
    "harvested by hand",
  );
  assert.equal(normalize("notes", "   "), null);
});

test("normalize formats decimal fields to two places", () => {
  assert.equal(normalize("quantity", 12), "12.00");
  assert.equal(normalize("quantity_received", "12.345"), "12.35");
  assert.equal(normalize("output_quantity", "not-a-number"), null);
});

test("normalize formats dates as ISO calendar dates", () => {
  assert.equal(
    normalize("harvest_date", new Date("2024-03-10T18:45:00.000Z")),
    "2024-03-10",
  );
  assert.equal(normalize("harvest_date", "  2024-03-10  "), "2024-03-10");
});

test("normalize preserves non-decimal numbers as strings", () => {
  assert.equal(normalize("batch_number", 42), "42");
  assert.equal(normalize("batch_number", false), "false");
});

test("computeDataHash hashes the selected fields in their declared order", () => {
  const row = {
    harvest_date: new Date("2024-03-10T18:45:00.000Z"),
    location: "  Jenin  ",
    olive_type: "Nabali",
    quantity: "12",
    cultivation_method: "organic",
    irrigation_method: "rain-fed",
    fertilizer_details: null,
    pesticide_details: "",
    harvesting_method: "manual",
    quality_details: "Grade A",
    farm_notes: "first harvest",
    ignored_field: "must not affect hash",
  };
  const payload = {
    eventType: "farm",
    batchId: "batch-123",
    harvest_date: "2024-03-10",
    location: "Jenin",
    olive_type: "Nabali",
    quantity: "12.00",
    cultivation_method: "organic",
    irrigation_method: "rain-fed",
    fertilizer_details: null,
    pesticide_details: null,
    harvesting_method: "manual",
    quality_details: "Grade A",
    farm_notes: "first harvest",
  };

  assert.equal(
    computeDataHash("farm", "batch-123", row),
    keccak256(toUtf8Bytes(JSON.stringify(payload))),
  );
});

test("computeDataHash ignores fields outside the event field list", () => {
  const baseline = Object.fromEntries(
    HASH_FIELDS.farm.map((field) => [field, "value"]),
  );
  const withExtra = { ...baseline, unrelated: "extra" };

  assert.equal(
    computeDataHash("farm", "batch-123", baseline),
    computeDataHash("farm", "batch-123", withExtra),
  );
});

test("computeDataHash changes when a selected field or batch ID changes", () => {
  const row = Object.fromEntries(
    HASH_FIELDS.farm.map((field) => [field, "value"]),
  );

  assert.notEqual(
    computeDataHash("farm", "batch-123", row),
    computeDataHash("farm", "batch-456", row),
  );
  assert.notEqual(
    computeDataHash("farm", "batch-123", row),
    computeDataHash("farm", "batch-123", { ...row, location: "different" }),
  );
});

test("computeDataHash rejects unknown event types", () => {
  assert.throws(
    () => computeDataHash("unknown", "batch-123", {}),
    /Unknown hash event type: unknown/,
  );
});
