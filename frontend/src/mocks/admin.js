import { ApiError } from "../api/client";
import { PARTICIPANT_ROLES } from "../auth/roles";
import { mockCaller } from "./auth";
import { maybeFailOnce, minedMockTx, prepareMockTx } from "./batches";
import {
  MOCK_ACCOUNTS,
  directoryMock,
  mockRoles,
  saveMockProfile,
} from "./participants";

// The admin role routes, with the backend's status codes and messages. Put
// "mock: fail save once" in the postal address to make the first confirm
// fail (tests retry).

const REGISTRY_CONTRACT = "0x5fbdb2315678afecb367f032d93f642f64180aa3";
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

function requireAdmin() {
  if (mockCaller() !== MOCK_ACCOUNTS.admin) {
    throw new ApiError(403, "caller is not a registry admin");
  }
}

function invalid(fieldErrors) {
  throw new ApiError(422, "invalid payload", { formErrors: [], fieldErrors });
}

function checkIdentity({ address, role, action }) {
  const fieldErrors = {};
  if (!ADDRESS.test(address || "")) fieldErrors.address = ["Invalid address"];
  if (!PARTICIPANT_ROLES.includes(role)) fieldErrors.role = ["Invalid role"];
  if (action !== "register" && action !== "revoke") {
    fieldErrors.action = ["Invalid action"];
  }
  if (Object.keys(fieldErrors).length) invalid(fieldErrors);
}

const changeText = ({ address, role, action }) =>
  `${action}:${role}:${address.toLowerCase()}`;

// Shape of GET /admin/participants.
export async function adminParticipantsMock() {
  await wait();
  requireAdmin();
  return { participants: directoryMock() };
}

// Shape of POST /admin/participants/prepare-role-change.
export async function prepareRoleChangeMock(body) {
  await wait();
  requireAdmin();
  checkIdentity(body);
  const { address, role, action } = body;
  const has = mockRoles(address).includes(role);
  if (action === "register" && has) {
    throw new ApiError(409, "participant already has this role");
  }
  if (action === "revoke" && !has) {
    throw new ApiError(409, "participant does not have this role");
  }
  const data = prepareMockTx({
    kind: "role",
    address: address.toLowerCase(),
    role,
    action,
    canonical: changeText(body),
  });
  return {
    address,
    role,
    action,
    transaction: { to: REGISTRY_CONTRACT, data, value: "0x0" },
  };
}

// Shape of POST /admin/participants/confirm-role-change.
export async function confirmRoleChangeMock(body) {
  await wait();
  requireAdmin();
  checkIdentity(body);
  const { address, role, action, txHash, profile } = body;
  if (action === "register" && !(profile && String(profile.name).trim())) {
    invalid({ profile: ["Name is required"] });
  }
  if (minedMockTx(txHash) !== changeText(body)) {
    const eventName = action === "register" ? "RoleGranted" : "RoleRevoked";
    throw new ApiError(
      409,
      `transaction has no matching ${eventName} event from caller`,
    );
  }
  if (mockRoles(address).includes(role) !== (action === "register")) {
    throw new ApiError(409, "on-chain role state does not match the action");
  }
  if (action === "register") {
    maybeFailOnce({ notes: profile.address }, txHash);
    saveMockProfile(address, profile);
  }
  return {
    address,
    action,
    role,
    txHash,
    roles: mockRoles(address),
    profileStored: action === "register",
  };
}
