import test from "node:test";
import assert from "node:assert/strict";
import { keccak256, toUtf8Bytes } from "ethers";
import { HASH_FIELDS } from "../src/hashing/fields.js";
import {
  canonicalValues,
  computeRecordHash,
  normalizeValue,
} from "../src/hashing/canonical.js";

const farmRow = {
  harvest_date: "2024-03-10",
  location: "Nablus",
  olive_type: "Nabali",
  quantity: "1200.50",
  cultivation_method: "organic",
  irrigation_method: "rain-fed",
  fertilizer_details: "compost",
  pesticide_details: "none",
  harvesting_method: "by hand",
  quality_details: "grade A",
  farm_notes: "early harvest",
};

test("normalizeValue treats empty values as an empty string and trims text", () => {
  assert.equal(normalizeValue("notes", undefined), "");
  assert.equal(normalizeValue("notes", null), "");
  assert.equal(normalizeValue("notes", "  by hand  "), "by hand");
  assert.equal(normalizeValue("notes", "   "), "");
});

test("normalizeValue formats dates as ISO calendar dates", () => {
  assert.equal(
    normalizeValue("harvest_date", new Date("2024-03-10T18:45:00.000Z")),
    "2024-03-10",
  );
  assert.equal(normalizeValue("harvest_date", " 2024-03-10 "), "2024-03-10");
});

test("decimal fields hash the same whatever form the client sends", () => {
  for (const value of [12.5, "12.5", "12.50", " 12.500 "]) {
    assert.equal(normalizeValue("quantity", value), "12.50");
  }
  assert.equal(normalizeValue("quantity_released", 3), "3.00");
  assert.equal(normalizeValue("quantity", ""), "");
  assert.equal(normalizeValue("quantity", "abc"), "abc");
  // expected_duration is an integer, not a decimal field.
  assert.equal(normalizeValue("expected_duration", 30), "30");
});

test("a quantity sent as number, string, or padded string yields one hash", () => {
  const hashes = [12.5, "12.5", "12.50"].map((quantity) =>
    computeRecordHash("farm", { ...farmRow, quantity }),
  );
  assert.equal(new Set(hashes).size, 1);
});

test("computeRecordHash hashes the declared fields in order", () => {
  const expected = keccak256(
    toUtf8Bytes(
      JSON.stringify(
        HASH_FIELDS.farm.map((f) =>
          f === "quantity" ? "1200.50" : farmRow[f],
        ),
      ),
    ),
  );
  assert.equal(computeRecordHash("farm", farmRow), expected);
});

test("computeRecordHash ignores fields outside the stage field list", () => {
  assert.equal(
    computeRecordHash("farm", { ...farmRow, extra: "ignored", batchId: "B1" }),
    computeRecordHash("farm", farmRow),
  );
});

test("computeRecordHash changes when a hashed field changes", () => {
  assert.notEqual(
    computeRecordHash("farm", farmRow),
    computeRecordHash("farm", { ...farmRow, location: "Jenin" }),
  );
  assert.notEqual(
    computeRecordHash("farm", farmRow),
    computeRecordHash("farm", { ...farmRow, quantity: "1200.51" }),
  );
});

test("computeRecordHash rejects unknown stages", () => {
  assert.throws(() => computeRecordHash("unknown", {}), /no field list/);
});

test("every stage in HASH_FIELDS can be hashed from an empty record", () => {
  for (const stage of Object.keys(HASH_FIELDS)) {
    assert.equal(canonicalValues(stage, {}).length, HASH_FIELDS[stage].length);
    assert.match(computeRecordHash(stage, {}), /^0x[0-9a-f]{64}$/);
  }
});
