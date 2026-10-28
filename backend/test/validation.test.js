import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { AppError } from "../src/errors.js";
import { parseBody, parseResponse } from "../src/validation/parse.js";
import {
  chainBatchResponseSchema,
  loginResponseSchema,
  nonceResponseSchema,
  writeAckSchema,
} from "../src/validation/response.schemas.js";

const statusOf = (fn) => {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof AppError);
    return err.status;
  }
  throw new Error("expected the call to throw");
};

test("parseBody returns the parsed data", () => {
  const schema = z.object({ name: z.string(), count: z.coerce.number() });
  assert.deepEqual(parseBody(schema, { name: "x", count: "2" }), {
    name: "x",
    count: 2,
  });
});

test("parseBody reports schema failures as 422", () => {
  const schema = z.object({ name: z.string() });
  assert.equal(
    statusOf(() => parseBody(schema, { name: 1 })),
    422,
  );

  try {
    parseBody(schema, { name: 1 });
  } catch (err) {
    assert.equal(err.message, "invalid payload");
    assert.ok(err.details);
  }
});

test("parseBody reports a missing or non-object body as 400", () => {
  const schema = z.object({ name: z.string() });
  for (const payload of [undefined, null, [], "text"]) {
    assert.equal(
      statusOf(() => parseBody(schema, payload)),
      400,
    );
  }
});

test("parseResponse treats a mismatch as an internal error", () => {
  assert.equal(
    statusOf(() => parseResponse(loginResponseSchema, { address: "0x1" })),
    500,
  );
});

test("response schemas accept the shapes the services return", () => {
  assert.equal(
    nonceResponseSchema.safeParse({
      address: "0x1",
      nonce: "n",
      message: "m",
    }).success,
    true,
  );

  assert.equal(
    loginResponseSchema.safeParse({
      address: "0x1",
      roles: ["FARMER"],
      token: "a.b.c",
    }).success,
    true,
  );

  assert.equal(
    chainBatchResponseSchema.safeParse({
      batchId: "b1",
      status: "Created",
      stage: "Farm",
      custodian: "0x1",
      pendingTarget: "0x2",
      destination: "0x3",
    }).success,
    true,
  );

  assert.equal(
    writeAckSchema.safeParse({ batchId: "b1", txHash: "0x1" }).success,
    true,
  );
});
