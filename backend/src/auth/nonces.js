import { randomBytes } from "node:crypto";

const TTL_MS = 5 * 60 * 1000;
// /auth/nonce is public, so the store must not grow with the number of
// addresses an anonymous caller makes up. One entry per address, and never
// more than this many in total.
const MAX_ENTRIES = 10_000;

export function buildMessage(nonce) {
  return `Sign in to Olive Traceability.\nNonce: ${nonce}`;
}

// The clock and limits can be replaced so the behaviour can be tested.
export function createNonceStore({
  ttlMs = TTL_MS,
  maxEntries = MAX_ENTRIES,
  now = Date.now,
} = {}) {
  const store = new Map();

  function sweepExpired() {
    const current = now();
    for (const [key, entry] of store) {
      if (entry.expiresAt <= current) store.delete(key);
    }
  }

  return {
    create(address) {
      const key = address.toLowerCase();
      // Re-inserting puts a repeat request at the back of the eviction order.
      store.delete(key);
      if (store.size >= maxEntries) sweepExpired();
      // Still full of live entries: drop the oldest rather than grow.
      while (store.size >= maxEntries) {
        store.delete(store.keys().next().value);
      }
      const nonce = randomBytes(16).toString("hex");
      store.set(key, { nonce, expiresAt: now() + ttlMs });
      return nonce;
    },

    // A nonce works once: it is removed whether or not it was still valid.
    consume(address) {
      const key = address.toLowerCase();
      const entry = store.get(key);
      store.delete(key);
      if (!entry || entry.expiresAt <= now()) return null;
      return entry.nonce;
    },

    get size() {
      return store.size;
    },
  };
}

const store = createNonceStore();

export const createNonce = (address) => store.create(address);
export const consumeNonce = (address) => store.consume(address);
