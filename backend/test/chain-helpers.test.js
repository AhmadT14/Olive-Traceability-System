import test from "node:test";
import assert from "node:assert/strict";
import { countByStage } from "../src/chain/stageCounts.js";

test("countByStage lists every stage in chain order, zeros included", () => {
  assert.deepEqual(countByStage(["Mill", "Farm", "Mill", "Retailer"]), [
    { stage: "Farm", count: 1 },
    { stage: "Mill", count: 2 },
    { stage: "Storage", count: 0 },
    { stage: "Exporter", count: 0 },
    { stage: "Importer", count: 0 },
    { stage: "Retailer", count: 1 },
  ]);
});

test("countByStage ignores values that are not stages", () => {
  const counts = countByStage(["Mill", undefined, "Nowhere"]);
  assert.equal(
    counts.reduce((sum, item) => sum + item.count, 0),
    1,
  );
});
