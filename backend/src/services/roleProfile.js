import { unprocessable } from "../errors.js";
import { profileDetailsSchemas } from "../validation/participant.schemas.js";

const SHARED_FIELDS = [
  "contactPhone",
  "email",
  "address",
  "location",
  "availability",
];

export function buildRoleProfile(address, role, profile, storedDetails) {
  const updates = { name: profile.name };
  for (const field of SHARED_FIELDS) {
    if (profile[field] !== undefined) updates[field] = profile[field];
  }

  if (profile.details !== undefined) {
    const result = profileDetailsSchemas[role].safeParse(profile.details);
    if (!result.success) {
      throw unprocessable("invalid profile details", result.error.flatten());
    }
    updates.details = { ...(storedDetails ?? {}), ...result.data };
  }

  return {
    values: { walletAddress: address.toLowerCase(), ...updates },
    updates,
  };
}
