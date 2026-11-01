import { ApiError } from "../api/client";
import { mockCaller } from "./auth";
import { mockRoles, storedProfile } from "./participants";

// Shape of GET /me/profile. Seeded participants have no contact fields.
export async function myProfileMock() {
  const address = mockCaller();
  const profile = storedProfile(address);
  if (!profile) throw new ApiError(404, "participant profile not found");
  return {
    address,
    roles: mockRoles(address),
    profile: {
      name: profile.name,
      contactPhone: profile.contactPhone ?? null,
      email: profile.email ?? null,
      address: profile.address ?? null,
      location: profile.location ?? null,
      availability: profile.availability ?? "available",
      details: {},
    },
  };
}
