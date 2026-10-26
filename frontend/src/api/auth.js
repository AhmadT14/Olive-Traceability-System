import { request } from "./client";
import { USE_MOCKS } from "./config";
import { nonceMock, loginMock } from "../mocks/auth";

export async function getNonce(address) {
  if (USE_MOCKS) return nonceMock(address);
  return request("/auth/nonce", { method: "POST", body: { address } });
}

export async function login(address, signature) {
  if (USE_MOCKS) return loginMock(address);
  return request("/auth/login", {
    method: "POST",
    body: { address, signature },
  });
}
