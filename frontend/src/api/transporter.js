import { request } from "./client";
import { USE_MOCKS } from "./config";
import {
  transporterJobsMock,
  completedJobsMock,
  prepareClaimMock,
  saveClaimMock,
  prepareHandoverMock,
  saveHandoverMock,
} from "../mocks/batches";

const enc = encodeURIComponent;

// { jobs: [{ id, status, batchId, stage, source, destination,
// outgoingDetails, createdAt }] }. Open jobs any transporter may claim.
export async function getTransporterJobs() {
  if (USE_MOCKS) return transporterJobsMock();
  return request("/transporter-jobs", { auth: true });
}

// Same shape: the caller's jobs still in progress, status "claimed" or
// "handover_pending".
export async function getMyTransporterJobs() {
  if (USE_MOCKS) return transporterJobsMock({ mine: true });
  return request("/transporter-jobs?mine=true", { auth: true });
}

// The caller's completed jobs, newest first, same job shape.
// Needs from backend: no route lists these yet, so only the mock has them.
// `available` is false on the real API and the page says so.
export async function getCompletedTransporterJobs() {
  if (USE_MOCKS) return { ...(await completedJobsMock()), available: true };
  return { jobs: [], available: false };
}

// Body: batchId and the pickup record fields.
export async function prepareClaim(body) {
  if (USE_MOCKS) return prepareClaimMock(body);
  return request("/batches/prepare-claim", {
    method: "POST",
    body,
    auth: true,
  });
}

// Body: txHash and the same pickup record fields sent to prepare.
export async function saveClaim(batchId, body) {
  if (USE_MOCKS) return saveClaimMock(batchId, body);
  return request(`/batches/${enc(batchId)}/transporter-claim`, {
    method: "POST",
    body,
    auth: true,
  });
}

// Body: batchId, targetAddress (the job destination) and the delivery fields.
export async function prepareHandover(body) {
  if (USE_MOCKS) return prepareHandoverMock(body);
  return request("/batches/prepare-handover", {
    method: "POST",
    body,
    auth: true,
  });
}

// Body: txHash and the same delivery record fields sent to prepare.
export async function saveHandover(batchId, body) {
  if (USE_MOCKS) return saveHandoverMock(batchId, body);
  return request(`/batches/${enc(batchId)}/transporter-handover`, {
    method: "POST",
    body,
    auth: true,
  });
}
