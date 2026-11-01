import { request } from "./client";
import { USE_MOCKS } from "./config";
import {
  adminParticipantsMock,
  prepareRoleChangeMock,
  confirmRoleChangeMock,
} from "../mocks/admin";
import { forgetParticipant } from "./participants";

function post(path, body) {
  return request(path, { method: "POST", body, auth: true });
}

// { participants: [{ address, name, location, availability, roles }] }.
// A participant whose roles were all revoked stays with roles: [].
export async function getAdminParticipants() {
  if (USE_MOCKS) return adminParticipantsMock();
  return request("/admin/participants", { auth: true });
}

// Takes the role change payload and sends only address, role and action.
// Returns { address, role, action, transaction }.
export async function prepareRoleChange({ address, role, action }) {
  const body = { address, role, action };
  if (USE_MOCKS) return prepareRoleChangeMock(body);
  return post("/admin/participants/prepare-role-change", body);
}

// Body: the same payload plus txHash. `profile` only for a registration.
// Returns { address, action, role, txHash, roles, profileStored }.
export async function confirmRoleChange(payload, txHash) {
  const body = { ...payload, txHash };
  const result = USE_MOCKS
    ? await confirmRoleChangeMock(body)
    : await post("/admin/participants/confirm-role-change", body);
  forgetParticipant(payload.address);
  return result;
}
