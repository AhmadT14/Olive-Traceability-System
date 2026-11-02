import test from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../src/errors.js";
import { revertReason, simulateTransaction } from "../src/chain/simulate.js";

const FROM = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const tx = {
  to: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  data: "0x1234",
  value: "0x0",
};

const callException = (fields) =>
  Object.assign(new Error("execution reverted"), {
    code: "CALL_EXCEPTION",
    ...fields,
  });

test("simulateTransaction adds from, chainId and the gas estimate", async () => {
  let asked;
  const provider = {
    estimateGas: async (request) => {
      asked = request;
      return 52_123n;
    },
  };

  const prepared = await simulateTransaction(provider, 31337, FROM, tx);

  assert.deepEqual(asked, { ...tx, from: FROM });
  assert.deepEqual(prepared, {
    ...tx,
    from: FROM,
    chainId: 31337,
    gas: "0xcb9b",
  });
});

test("simulateTransaction turns a revert into a 409 with the reason", async () => {
  const provider = {
    estimateGas: async () => {
      throw callException({
        reason: "BatchCustody: caller is not current custodian",
      });
    },
  };

  await assert.rejects(
    simulateTransaction(provider, 31337, FROM, tx),
    (err) =>
      err instanceof AppError &&
      err.status === 409 &&
      err.message ===
        "transaction would fail: BatchCustody: caller is not current custodian",
  );
});

test("simulateTransaction passes on errors that are not reverts", async () => {
  const provider = {
    estimateGas: async () => {
      throw Object.assign(new Error("connect ECONNREFUSED"), {
        code: "NETWORK_ERROR",
      });
    },
  };

  await assert.rejects(
    simulateTransaction(provider, 31337, FROM, tx),
    (err) => !(err instanceof AppError) && /ECONNREFUSED/.test(err.message),
  );
});

test("revertReason uses the message, then the custom error name", () => {
  assert.equal(revertReason({ reason: "BatchCustody: x" }), "BatchCustody: x");
  assert.equal(
    revertReason({
      reason: null,
      revert: { name: "AccessControlUnauthorizedAccount" },
    }),
    "AccessControlUnauthorizedAccount",
  );
  assert.equal(revertReason({}), "execution reverted");
});
