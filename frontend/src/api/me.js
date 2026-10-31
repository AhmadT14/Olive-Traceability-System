import { request } from "./client";
import { USE_MOCKS } from "./config";
import { myProfileMock } from "../mocks/me";
import { myBatchesMock, createdBatchesMock } from "../mocks/batches";

// { address, roles, profile: { name, contactPhone, email, address, location,
// availability, details } }. 404 when the wallet has no profile.
export async function getMyProfile() {
  if (USE_MOCKS) return myProfileMock();
  return request("/me/profile", { auth: true });
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
