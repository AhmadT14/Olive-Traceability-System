import test from "node:test";
import assert from "node:assert/strict";
import { DrizzleQueryError } from "drizzle-orm";
import { isUniqueViolation } from "../src/errors.js";

const pgError = (code) => Object.assign(new Error("pg error"), { code });

test("a unique violation wrapped by Drizzle is detected", () => {
  const wrapped = new DrizzleQueryError("insert", [], pgError("23505"));
  assert.equal(wrapped.code, undefined);
  assert.equal(isUniqueViolation(wrapped), true);
});

test("a bare unique violation is detected", () => {
  assert.equal(isUniqueViolation(pgError("23505")), true);
});

test("other database errors are not unique violations", () => {
  assert.equal(isUniqueViolation(pgError("23503")), false);
  assert.equal(
    isUniqueViolation(new DrizzleQueryError("insert", [], pgError("23514"))),
    false,
  );
  assert.equal(isUniqueViolation(new Error("connection refused")), false);
  assert.equal(isUniqueViolation(undefined), false);
});
