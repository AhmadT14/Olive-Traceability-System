import { getToken } from "../api/client";
import { MOCK_ACCOUNTS, mockRoles } from "./participants";

export { mockRoles };

const TOKEN_MS = 60 * 60 * 1000;

// The mock token carries the address and expiry, so mocks know who is calling.
export function mockCaller() {
  return (getToken() || "").split(":")[1] || "";
}

function mockExpiry() {
  return Number((getToken() || "").split(":")[2]) || Date.now() + TOKEN_MS;
}

function session(address, expiresMs) {
  return {
    address,
    roles: mockRoles(address),
    isAdmin: String(address).toLowerCase() === MOCK_ACCOUNTS.admin,
    expiresAt: new Date(expiresMs).toISOString(),
  };
}

export function nonceMock(address) {
  const nonce = `mock-${Date.now()}`;
  return {
    address,
    nonce,
    message: `Sign in to Olive Traceability. Nonce: ${nonce}`,
  };
}

export function loginMock(address) {
  const expiresMs = Date.now() + TOKEN_MS;
  return {
    ...session(address, expiresMs),
    token: `mock-token:${address.toLowerCase()}:${expiresMs}`,
  };
}

export function meMock() {
  return session(mockCaller(), mockExpiry());
}
