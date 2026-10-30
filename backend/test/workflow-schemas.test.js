import test from "node:test";
import assert from "node:assert/strict";
import { getStageAfter } from "../src/chain/checks.js";
import {
  createBatchSchema,
  farmPreparationSchema,
} from "../src/validation/batch.schemas.js";
import { receiptSchemas } from "../src/validation/receipt.schemas.js";
import {
  prepareOilDeliverySchema,
  prepareOilPickupSchema,
  prepareOliveDeliverySchema,
  prepareOlivePickupSchema,
} from "../src/validation/transporter.schemas.js";

const wallet = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

test("preparing a transporter transaction does not need a txHash", () => {
  // The hash only exists after the wallet has sent the transaction.
  assert.ok(prepareOlivePickupSchema.safeParse({ batchId: "B1" }).success);
  assert.ok(prepareOilPickupSchema.safeParse({ batchId: "B1" }).success);
  for (const schema of [prepareOliveDeliverySchema, prepareOilDeliverySchema]) {
    assert.ok(
      schema.safeParse({ batchId: "B1", targetAddress: wallet }).success,
    );
  }
});

test("harvest_date, location and olive_type are required and non-empty", () => {
  const farm = {
    batchId: "B1",
    harvest_date: "2026-10-01",
    location: "Nablus",
    olive_type: "Nabali",
  };
  const prepare = { ...farm, destinationAddress: wallet };
  const save = { ...farm, txHash: `0x${"a".repeat(64)}` };

  assert.ok(farmPreparationSchema.safeParse(prepare).success);
  assert.ok(createBatchSchema.safeParse(save).success);

  for (const field of ["harvest_date", "location", "olive_type"]) {
    for (const value of [undefined, "", "   "]) {
      assert.equal(
        farmPreparationSchema.safeParse({ ...prepare, [field]: value }).success,
        false,
        `prepare accepted ${field}=${JSON.stringify(value)}`,
      );
      assert.equal(
        createBatchSchema.safeParse({ ...save, [field]: value }).success,
        false,
        `save accepted ${field}=${JSON.stringify(value)}`,
      );
    }
  }
});

test("getStageAfter gives the stage a receipt moves the batch to", () => {
  assert.equal(getStageAfter("Farm"), "Mill");
  assert.equal(getStageAfter("Mill"), "Storage");
  assert.equal(getStageAfter("Storage"), "Exporter");
  assert.equal(getStageAfter("Exporter"), "Importer");
  assert.equal(getStageAfter("Importer"), "Retailer");
  assert.equal(getStageAfter("Retailer"), null);
  assert.equal(getStageAfter("nonsense"), null);
});

test("every receiving stage has a receipt definition for its own role", () => {
  const roles = {
    Mill: "MILL",
    Storage: "STORAGE",
    Exporter: "EXPORTER",
    Importer: "IMPORTER",
    Retailer: "RETAILER",
  };
  assert.deepEqual(Object.keys(receiptSchemas), Object.keys(roles));
  for (const [stage, role] of Object.entries(roles)) {
    assert.equal(receiptSchemas[stage].role, role);
  }
  // A batch about to be received is still in the sender's stage, so every
  // stage that has a next stage must resolve to a receipt definition.
  for (const sender of ["Farm", "Mill", "Storage", "Exporter", "Importer"]) {
    assert.ok(
      receiptSchemas[getStageAfter(sender)],
      `no receipt after ${sender}`,
    );
  }
});
