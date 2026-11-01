import { ApiError } from "../api/client";
import { PROFILE_DETAILS } from "../forms/profileFields";
import { mockCaller } from "./auth";
import { mockRoles, saveMockProfile, storedProfile } from "./participants";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

function requireProfile(address) {
  const profile = storedProfile(address);
  if (!profile) {
    throw new ApiError(
      404,
      "no profile on file for this wallet; ask the admin",
    );
  }
  return profile;
}

function invalid(message, fieldErrors) {
  throw new ApiError(422, message, { formErrors: [], fieldErrors });
}

// Shape of GET /me/profile and PATCH /me/profile. Seeded participants have no
// contact fields.
function profileView(address) {
  const profile = requireProfile(address);
  return {
    address,
    roles: mockRoles(address),
    profile: {
      name: profile.name,
      contactPhone: profile.contactPhone ?? null,
      email: profile.email ?? null,
      address: profile.address ?? null,
      location: profile.location ?? null,
      availability: profile.availability ?? null,
      details: profile.details ?? {},
    },
  };
}

export async function myProfileMock() {
  return profileView(mockCaller());
}

// PATCH /me/profile: sent fields replace the stored ones; details are merged
// key by key and checked against the first role, like the backend.
export async function updateMyProfileMock(body) {
  await wait();
  const address = mockCaller();
  const stored = requireProfile(address);
  const { details, ...fields } = body;
  if (!Object.keys(body).length) {
    invalid("invalid payload", {});
  }
  if ("availability" in fields) {
    invalid("invalid payload", { availability: ["Unrecognized key"] });
  }
  if ("name" in fields && !String(fields.name).trim()) {
    invalid("invalid payload", { name: ["Required"] });
  }
  if ("email" in fields && !EMAIL.test(fields.email)) {
    invalid("invalid payload", { email: ["Invalid email"] });
  }

  const updates = { ...fields };
  if (details !== undefined) {
    const role = mockRoles(address)[0];
    if (!role) throw new ApiError(403, "wallet has no registered role");
    const keys = PROFILE_DETAILS[role].map((f) => f.name);
    const merged = { ...stored.details, ...details };
    updates.details = Object.fromEntries(
      Object.entries(merged).filter(([key]) => keys.includes(key)),
    );
  }
  saveMockProfile(address, updates);
  return profileView(address);
}

// PATCH /me/availability.
export async function updateMyAvailabilityMock(body) {
  await wait();
  const address = mockCaller();
  requireProfile(address);
  const { availability } = body;
  if (availability !== "available" && availability !== "unavailable") {
    invalid("invalid payload", { availability: ["Invalid enum value"] });
  }
  saveMockProfile(address, { availability });
  return { address, availability };
}
