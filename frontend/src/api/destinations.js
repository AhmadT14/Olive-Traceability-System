import { request } from "./client";
import { USE_MOCKS } from "./config";
import { millDestinationsMock } from "../mocks/participants";
import { batchDestinationsMock } from "../mocks/batches";

export async function getMillDestinations() {
  if (USE_MOCKS) return millDestinationsMock();
  return request("/destinations?role=MILL", { auth: true });
}

// { batchId, stage, role, destinations: [{ address, name, role }] }: the
// available facilities of the next stage. Only for the current custodian.
export async function getBatchDestinations(batchId) {
  if (USE_MOCKS) return batchDestinationsMock(batchId);
  return request(`/batches/${encodeURIComponent(batchId)}/destinations`, {
    auth: true,
  });
}
