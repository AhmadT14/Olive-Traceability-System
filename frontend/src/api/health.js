import { request } from "./client";
import { USE_MOCKS } from "./config";
import { healthMock } from "../mocks/health";

export async function getHealth() {
  if (USE_MOCKS) return healthMock;
  return request("/health");
}
