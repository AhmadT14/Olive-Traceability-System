import { randomBytes } from "node:crypto";

const TTL_MS = 5 * 60 * 1000; 
const store = new Map(); 

export function buildMessage(nonce) {
  return `Sign in to Olive Traceability.\nNonce: ${nonce}`;
}

export function createNonce(address) {
  const nonce = randomBytes(16).toString("hex");
  store.set(address.toLowerCase(), { nonce, expiresAt: Date.now() + TTL_MS });
  return nonce;
}

export function consumeNonce(address) {
  const key = address.toLowerCase();
  const entry = store.get(key);
  store.delete(key);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.nonce;
}