import test from "node:test";
import assert from "node:assert/strict";
import { collectAddresses } from "../src/chain/addresses.js";
import { historyResponseSchema } from "../src/validation/response.schemas.js";

const FARMER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const MILL = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const ZERO = "0x0000000000000000000000000000000000000000";
const hash = `0x${"a".repeat(64)}`;

test("collectAddresses returns each wallet once, lower-cased and sorted", () => {
  const events = [
    { args: { batchId: "B1", farmer: FARMER, harvestDataHash: hash } },
    { args: { custodian: FARMER, destination: MILL } },
    { args: { newCustodian: MILL.toLowerCase(), pendingTarget: ZERO } },
  ];
  // 0x3c44... sorts before 0x7099...
  assert.deepEqual(collectAddresses(events), [
    MILL.toLowerCase(),
    FARMER.toLowerCase(),
  ]);
});

test("collectAddresses skips the zero address, hashes and plain text", () => {
  assert.deepEqual(
    collectAddresses([
      { args: { a: ZERO, b: hash, c: "Nablus", d: "0x1234", e: 5 } },
      { args: {} },
      {},
    ]),
    [],
  );
});

test("the history response carries a name map for the journey's wallets", () => {
  const body = {
    batchId: "B1",
    participants: {
      [FARMER.toLowerCase()]: { name: "Nablus Hills Farm", location: "Nablus" },
      [MILL.toLowerCase()]: { name: null, location: null },
    },
    events: [],
  };
  assert.ok(historyResponseSchema.safeParse(body).success);
  assert.ok(
    historyResponseSchema.safeParse({ ...body, participants: {} }).success,
  );
  const { participants: _omitted, ...without } = body;
  assert.equal(historyResponseSchema.safeParse(without).success, false);
});
