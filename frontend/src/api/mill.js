import { request } from "./client";
import { USE_MOCKS } from "./config";
import {
  saveMillIntakeMock,
  prepareStageListingMock,
  saveMillOutgoingMock,
} from "../mocks/batches";

const enc = encodeURIComponent;

// Body: txHash and the same mill receipt fields sent to prepareReceipt.
export async function saveMillIntake(batchId, body) {
  if (USE_MOCKS) return saveMillIntakeMock(batchId, body);
  return request(`/batches/${enc(batchId)}/mill-intake`, {
    method: "POST",
    body,
    auth: true,
  });
}

// Body: batchId, destinationAddress (a storage facility) and the mill
// outgoing fields.
export async function prepareMillListing(body) {
  if (USE_MOCKS) return prepareStageListingMock("mill", body);
  return request("/batches/prepare-listing", {
    method: "POST",
    body,
    auth: true,
  });
}

// Body: txHash and the same mill outgoing fields sent to prepare.
export async function saveMillOutgoing(batchId, body) {
  if (USE_MOCKS) return saveMillOutgoingMock(batchId, body);
  return request(`/batches/${enc(batchId)}/mill-outgoing`, {
    method: "POST",
    body,
    auth: true,
  });
}
