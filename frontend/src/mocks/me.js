import { ApiError } from "../api/client";
import { mockCaller } from "./auth";
import { profileMock } from "./participants";

// Shape of GET /me/profile. Contact fields are empty in the mock.
export async function myProfileMock() {
  const address = mockCaller();
  const profile = profileMock(address);
  if (!profile) throw new ApiError(404, "participant profile not found");
  return {
    address,
    roles: profile.roles,
    profile: {
      name: profile.name,
      contactPhone: null,
      email: null,
      address: null,
      location: profile.location,
      availability: "available",
      details: {},
    },
  };
}
