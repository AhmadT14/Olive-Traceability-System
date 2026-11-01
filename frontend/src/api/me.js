import { request } from "./client";
import { USE_MOCKS } from "./config";
import {
  myProfileMock,
  updateMyProfileMock,
  updateMyAvailabilityMock,
} from "../mocks/me";
import { forgetParticipant } from "./participants";
import {
  myBatchesMock,
  createdBatchesMock,
  receivedBatchesMock,
} from "../mocks/batches";

// { address, roles, profile: { name, contactPhone, email, address, location,
// availability, details } }. 404 when the wallet has no profile.
export async function getMyProfile() {
  if (USE_MOCKS) return myProfileMock();
  return request("/me/profile", { auth: true });
}

// Body: any of name, contactPhone, email, address, location, details (at
// least one). details is merged key by key. Returns the GET /me/profile shape.
export async function updateMyProfile(body) {
  const result = USE_MOCKS
    ? await updateMyProfileMock(body)
    : await request("/me/profile", { method: "PATCH", body, auth: true });
  forgetParticipant(result.address);
  return result;
}

// "available" or "unavailable". Returns { address, availability }.
export async function updateMyAvailability(availability) {
  const body = { availability };
  const result = USE_MOCKS
    ? await updateMyAvailabilityMock(body)
    : await request("/me/availability", { method: "PATCH", body, auth: true });
  forgetParticipant(result.address);
  return result;
}

// { holding, listedByMe, awaitingMyConfirmation }, each a list of chain states.
export async function getMyBatches() {
  if (USE_MOCKS) return myBatchesMock();
  return request("/me/batches", { auth: true });
}

// GET /me/batches/created: every batch the caller created as a farmer, newest
// first, with its current chain state plus harvestDate, createdBlock and
// createdAt. Only batches saved through POST /batches are listed.
export async function getFarmerBatches() {
  if (USE_MOCKS) return createdBatchesMock();
  return request("/me/batches/created", { auth: true });
}

// Every batch the caller confirmed receipt of, newest first:
// { batches: [{ batchId, receivedBlock, receivedAt, quantityReceived }] }.
// Needs from backend: no route lists these yet, so only the mock has them.
// `available` is false on the real API and the page says so.
export async function getReceivedBatches() {
  if (USE_MOCKS) return { ...(await receivedBatchesMock()), available: true };
  return { batches: [], available: false };
}
