import test from "node:test";
import assert from "node:assert/strict";
import { buildMessage, createNonceStore } from "../src/auth/nonces.js";

const A = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const B = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const addr = (n) => `0x${n.toString(16).padStart(40, "0")}`;

function clock(start = 1_000) {
  let time = start;
  return { now: () => time, advance: (ms) => (time += ms) };
}

test("a nonce is accepted once, whatever the case of the address", () => {
  const store = createNonceStore();
  const nonce = store.create(A);
  assert.match(nonce, /^[0-9a-f]{32}$/);
  assert.equal(store.consume(A.toLowerCase()), nonce);
  assert.equal(store.consume(A), null, "a second use must fail");
});

test("asking again replaces the earlier nonce", () => {
  const store = createNonceStore();
  const first = store.create(A);
  const second = store.create(A);
  assert.notEqual(first, second);
  assert.equal(store.size, 1);
  assert.equal(store.consume(A), second);
});

test("a nonce expires after its lifetime and is then discarded", () => {
  const time = clock();
  const store = createNonceStore({ ttlMs: 1_000, now: time.now });
  const nonce = store.create(A);
  time.advance(999);
  assert.equal(store.consume(A), nonce);

  store.create(B);
  time.advance(1_000);
  assert.equal(store.consume(B), null);
  assert.equal(store.size, 0, "an expired entry is removed when it is tried");
});

test("an anonymous caller cannot grow the store past its limit", () => {
  const store = createNonceStore({ maxEntries: 100 });
  for (let i = 0; i < 5_000; i += 1) store.create(addr(i));
  assert.equal(store.size, 100);
});

test("when full, expired entries go first and live ones are kept", () => {
  const time = clock();
  const store = createNonceStore({
    maxEntries: 3,
    ttlMs: 1_000,
    now: time.now,
  });
  store.create(addr(1));
  store.create(addr(2));
  time.advance(1_500); // the first two are now expired
  const live = store.create(addr(3));
  store.create(addr(4));
  store.create(addr(5)); // fills the store: only 1 and 2 may be dropped
  assert.equal(store.size, 3);
  assert.equal(store.consume(addr(3)), live);
});

test("when full of live entries the oldest is dropped, not the newest", () => {
  const store = createNonceStore({ maxEntries: 2 });
  store.create(addr(1));
  store.create(addr(2));
  const newest = store.create(addr(3));
  assert.equal(store.size, 2);
  assert.equal(store.consume(addr(1)), null);
  assert.equal(store.consume(addr(3)), newest);
});

test("the sign-in message carries the nonce", () => {
  assert.equal(
    buildMessage("abc"),
    "Sign in to Olive Traceability.\nNonce: abc",
  );
});
