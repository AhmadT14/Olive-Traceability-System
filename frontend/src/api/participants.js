import { request } from "./client";
import { USE_MOCKS } from "./config";
import { profileMock } from "../mocks/participants";

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
