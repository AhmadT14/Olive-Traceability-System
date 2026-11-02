import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Interface, id } from "ethers";
import { eventArgsToObject } from "../src/chain/eventArgs.js";
import { AppError } from "../src/errors.js";
import { buildRoleProfile } from "../src/services/roleProfile.js";

const custody = new Interface(
  JSON.parse(
    readFileSync(
      new URL("../src/chain/abis/BatchCustody.json", import.meta.url),
      "utf8",
    ),
  ),
);

const FARMER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const MILL = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";

test("eventArgsToObject gives the batch id topic hash, not [object Object]", () => {
  const harvestHash = id("harvest");
  const parsed = custody.parseLog(
    custody.encodeEventLog("BatchCreated", ["B1", FARMER, MILL, harvestHash]),
  );

  assert.deepEqual(eventArgsToObject(parsed), {
    batchId: id("B1"),
    farmer: FARMER,
    destinationAddress: MILL,
    harvestDataHash: harvestHash,
  });
});

test("eventArgsToObject works on the shape decodeTx returns", () => {
  const parsed = custody.parseLog(
    custody.encodeEventLog("BatchClaimed", ["B1", FARMER, id("pickup")]),
  );
  const event = {
    name: parsed.name,
    fragment: parsed.fragment,
    args: parsed.args,
  };

  assert.equal(eventArgsToObject(event).batchId, id("B1"));
  assert.equal(eventArgsToObject(event).transporter, FARMER);
});

test("buildRoleProfile leaves details out when the request has none", () => {
  const { values, updates } = buildRoleProfile(MILL, "MILL", {
    name: "Al-Salam Olive Mill",
  });

  assert.deepEqual(updates, { name: "Al-Salam Olive Mill" });
  assert.deepEqual(values, {
    walletAddress: MILL.toLowerCase(),
    name: "Al-Salam Olive Mill",
  });
});

test("buildRoleProfile writes only the fields that were sent", () => {
  const { updates } = buildRoleProfile(MILL, "MILL", {
    name: "Al-Salam Olive Mill",
    location: "Jenin",
    details: { processingCapacity: 5000 },
  });

  assert.deepEqual(updates, {
    name: "Al-Salam Olive Mill",
    location: "Jenin",
    details: { processingCapacity: 5000 },
  });
});

test("buildRoleProfile rejects invalid details with 422", () => {
  assert.throws(
    () =>
      buildRoleProfile(MILL, "MILL", {
        name: "Al-Salam Olive Mill",
        details: { facilityName: 42 },
      }),
    (err) =>
      err instanceof AppError &&
      err.status === 422 &&
      err.message === "invalid profile details",
  );
});
