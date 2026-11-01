import { request } from "./client";
import { USE_MOCKS } from "./config";
import { profileMock, participantRolesMock } from "../mocks/participants";

const cache = new Map();

async function loadProfile(address) {
  if (USE_MOCKS) return profileMock(address);
  try {
    return await request(`/participants/${address}/profile`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

// Public profile: { address, name, location, roles }, or null when the backend
// has no profile for the wallet. Cached per address; failed calls are retried.
export async function getParticipantProfile(address) {
  const key = String(address).toLowerCase();
  if (!cache.has(key)) {
    const pending = loadProfile(key);
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return cache.get(key);
}

const listeners = new Set();

// Runs listener(address) whenever a profile was changed in this tab. Returns
// the unsubscribe function.
export function onParticipantChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Drops a cached profile after it was changed (by the admin or the owner).
export function forgetParticipant(address) {
  const key = String(address).toLowerCase();
  cache.delete(key);
  listeners.forEach((listener) => listener(key));
}

// Active registry roles read from the chain: { address, roles }. Not cached,
// because the admin pages change them.
export async function getParticipantRoles(address) {
  if (USE_MOCKS) return participantRolesMock(address);
  return request(`/participants/${address}/roles`);
}

// Fills the cache from the `participants` map of GET /batches/:id/history, so
// the journey needs no profile request per facility. These entries carry only
// name and location (no roles). Wallets missing from the map are still loaded.
export function rememberParticipants(participants) {
  for (const [address, p] of Object.entries(participants || {})) {
    const key = address.toLowerCase();
    if (!cache.has(key))
      cache.set(key, Promise.resolve({ address: key, ...p }));
  }
}
