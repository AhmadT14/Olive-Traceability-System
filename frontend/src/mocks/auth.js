import { getToken } from "../api/client";
import { MOCK_ACCOUNTS } from "./participants";

// One role per default Anvil account. Account 0 is the admin.
const MOCK_ROLES = {
  [MOCK_ACCOUNTS.farmer]: ["FARMER"],
  [MOCK_ACCOUNTS.mill]: ["MILL"],
  [MOCK_ACCOUNTS.transporter]: ["TRANSPORTER"],
  [MOCK_ACCOUNTS.storage]: ["STORAGE"],
  [MOCK_ACCOUNTS.exporter]: ["EXPORTER"],
  [MOCK_ACCOUNTS.importer]: ["IMPORTER"],
  [MOCK_ACCOUNTS.retailer]: ["RETAILER"],
};

export function mockRoles(address) {
  return MOCK_ROLES[String(address).toLowerCase()] || [];
}

// The mock token carries the address, so mocks know who is calling.
export function mockCaller() {
  return (getToken() || "").split(":")[1] || "";
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
  return {
    address,
    roles: mockRoles(address),
    token: `mock-token:${address.toLowerCase()}`,
  };
}

export function meMock() {
  const address = mockCaller();
  return { address, roles: mockRoles(address) };
}
