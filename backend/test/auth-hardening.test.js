import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { Wallet, verifyMessage } from "ethers";
import { buildMessage, createNonceStore } from "../src/auth/nonces.js";
import {
  TOKEN_AUDIENCE,
  TOKEN_ISSUER,
  canRefresh,
  signToken,
  verifyToken,
} from "../src/auth/tokens.js";
import { checkChain } from "../src/chain/startup.js";

const SECRET = "a-test-secret-that-is-at-least-32-characters";
const REGISTRY = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const CUSTODY = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

test("a signed token verifies and carries issuer and audience", () => {
  const token = signToken({ address: "0xabc", roles: ["MILL"] }, SECRET);
  const payload = verifyToken(token, SECRET);

  assert.equal(payload.address, "0xabc");
  assert.deepEqual(payload.roles, ["MILL"]);
  assert.equal(payload.iss, TOKEN_ISSUER);
  assert.equal(payload.aud, TOKEN_AUDIENCE);
  assert.equal(payload.exp - payload.iat, 3600);
  assert.equal(payload.auth_time, payload.iat);
});

test("a refreshed token keeps the login time and never outlives 24 hours", () => {
  const loggedIn = 1_000_000;
  const late = loggedIn + 23 * 3600 + 30 * 60;
  const token = signToken({ address: "0xabc", roles: [] }, SECRET, {
    authTime: loggedIn,
    now: late,
  });
  const payload = jwt.decode(token);

  assert.equal(payload.auth_time, loggedIn);
  assert.equal(payload.iat, late);
  assert.equal(payload.exp, loggedIn + 24 * 3600);
});

test("canRefresh allows a session younger than 24 hours only", () => {
  const loggedIn = 1_000_000;
  assert.equal(canRefresh(loggedIn, loggedIn + 3600), true);
  assert.equal(canRefresh(loggedIn, loggedIn + 24 * 3600 - 1), true);
  assert.equal(canRefresh(loggedIn, loggedIn + 24 * 3600), false);
  assert.equal(canRefresh(undefined, loggedIn), false);
});

test("a token with another algorithm is rejected", () => {
  const token = jwt.sign({ address: "0xabc" }, SECRET, {
    algorithm: "HS512",
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });
  assert.throws(() => verifyToken(token, SECRET));
});

test("a token without our issuer or audience is rejected", () => {
  const plain = jwt.sign({ address: "0xabc" }, SECRET, { expiresIn: "1h" });
  assert.throws(() => verifyToken(plain, SECRET));

  const otherAudience = jwt.sign({ address: "0xabc" }, SECRET, {
    issuer: TOKEN_ISSUER,
    audience: "someone-else",
  });
  assert.throws(() => verifyToken(otherAudience, SECRET));
});

test("a wallet signature over the issued message recovers the wallet", async () => {
  const wallet = Wallet.createRandom();
  const entry = createNonceStore().create(wallet.address);
  const fields = {
    domain: "localhost:5173",
    uri: "http://localhost:5173",
    address: wallet.address.toLowerCase(),
    chainId: 31337,
    ...entry,
  };

  const signature = await wallet.signMessage(buildMessage(fields));

  assert.equal(verifyMessage(buildMessage(fields), signature), wallet.address);
  assert.notEqual(
    verifyMessage(buildMessage({ ...fields, chainId: 1 }), signature),
    wallet.address,
  );
});

const fakeProvider = ({
  chainId = "0x7a69",
  code = {},
  fail = false,
} = {}) => ({
  send: async () => {
    if (fail) throw new Error("connect ECONNREFUSED");
    return chainId;
  },
  getCode: async (address) => code[address] ?? "0x6080",
});

const expected = {
  chainId: 31337,
  contracts: { REGISTRY_ADDRESS: REGISTRY, BATCH_CUSTODY_ADDRESS: CUSTODY },
};

test("checkChain passes when the chain id and both contracts match", async () => {
  assert.deepEqual(await checkChain(fakeProvider(), expected), []);
});

test("checkChain stops at a wrong chain id", async () => {
  const provider = fakeProvider({ chainId: "0x1" });
  provider.getCode = async () => {
    throw new Error("network changed");
  };

  assert.deepEqual(await checkChain(provider, expected), [
    "chain id is 1, but CHAIN_ID is 31337",
  ]);
});

test("checkChain reports a missing contract", async () => {
  const problems = await checkChain(
    fakeProvider({ code: { [CUSTODY]: "0x" } }),
    expected,
  );

  assert.equal(problems.length, 1);
  assert.match(problems[0], /no contract at BATCH_CUSTODY_ADDRESS/);
});

test("checkChain reports a contract it cannot read", async () => {
  const provider = fakeProvider();
  provider.getCode = async () => {
    throw new Error("socket hang up");
  };

  const problems = await checkChain(provider, expected);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /cannot read REGISTRY_ADDRESS \(socket hang up\)/);
});

test("checkChain reports an unreachable RPC", async () => {
  const problems = await checkChain(fakeProvider({ fail: true }), expected);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /cannot reach the chain at RPC_URL/);
});

test("checkChain gives up on an RPC that never answers", async () => {
  const silent = {
    send: () => new Promise(() => {}),
    getCode: async () => "0x",
  };
  const problems = await checkChain(silent, expected, 20);
  assert.match(problems[0], /no answer after 20 ms/);
});
