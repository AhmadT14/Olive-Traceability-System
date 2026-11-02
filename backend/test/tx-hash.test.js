import test from "node:test";
import assert from "node:assert/strict";
import { txHashSchema } from "../src/validation/common.schemas.js";

const hex = "ab".repeat(32);

test("a transaction hash is lower-cased whatever case it was sent in", () => {
  assert.equal(txHashSchema.parse(`0x${hex.toUpperCase()}`), `0x${hex}`);
  assert.equal(txHashSchema.parse(`0x${hex}`), `0x${hex}`);
});

test("a malformed transaction hash is still rejected", () => {
  assert.equal(txHashSchema.safeParse("0x1234").success, false);
  assert.equal(txHashSchema.safeParse(`0X${hex}`).success, false);
});
