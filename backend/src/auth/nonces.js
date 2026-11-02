import { randomBytes } from "node:crypto";
import { getAddress } from "ethers";

const TTL_MS = 5 * 60 * 1000;
// /auth/nonce is public, so the store must not grow with the number of
// addresses an anonymous caller makes up. One entry per address, and never
// more than this many in total.
const MAX_ENTRIES = 10_000;

const STATEMENT = "Sign in to Olive Traceability.";

export function buildMessage({
  domain,
  uri,
  address,
  chainId,
  nonce,
  issuedAt,
  expiresAt,
}) {
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    getAddress(address),
    "",
    STATEMENT,
    "",
    `URI: ${uri}`,
    "Version: 1",
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date(issuedAt).toISOString()}`,
    `Expiration Time: ${new Date(expiresAt).toISOString()}`,
  ].join("\n");
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
      const issuedAt = now();
      const entry = {
        nonce: randomBytes(16).toString("hex"),
        issuedAt,
        expiresAt: issuedAt + ttlMs,
      };
      store.set(key, entry);
      return entry;
    },

    // A nonce works once: it is removed whether or not it was still valid.
    consume(address) {
      const key = address.toLowerCase();
      const entry = store.get(key);
      store.delete(key);
      if (!entry || entry.expiresAt <= now()) return null;
      return entry;
    },

    get size() {
      return store.size;
    },
  };
}

const store = createNonceStore();

export const createNonce = (address) => store.create(address);
export const consumeNonce = (address) => store.consume(address);
