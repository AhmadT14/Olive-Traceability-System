import { request } from "./client";
import { USE_MOCKS } from "./config";
import { millDestinationsMock } from "../mocks/participants";

export async function getMillDestinations() {
  if (USE_MOCKS) return millDestinationsMock();
  return request("/destinations?role=MILL", { auth: true });
}
