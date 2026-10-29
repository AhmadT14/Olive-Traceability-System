import { profileMock } from "../mocks/participants";

const cache = new Map();

// Gap 6: there is no public profile route yet, so this always uses the mock,
// even with VITE_USE_MOCKS=false. Swap the body for the real call when the
// backend adds one. Returns { address, name, location } or null.
export async function getParticipantProfile(address) {
  const key = String(address).toLowerCase();
  if (!cache.has(key)) cache.set(key, profileMock(key));
  return cache.get(key);
}
