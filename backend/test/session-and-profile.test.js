import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyBatchForParticipant,
  isAvailable,
} from "../src/chain/checks.js";
import {
  updateAvailabilitySchema,
  updateProfileSchema,
} from "../src/validation/participant.schemas.js";
import { parseMineQuery } from "../src/validation/parse.js";
import {
  adminParticipantsResponseSchema,
  availabilityResponseSchema,
  loginResponseSchema,
  myBatchesResponseSchema,
  myProfileResponseSchema,
  participantRolesResponseSchema,
  publicProfileResponseSchema,
  sessionSchema,
} from "../src/validation/response.schemas.js";

const ME = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const OTHER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const NOBODY = "0x0000000000000000000000000000000000000000";

const batch = (over) => ({
  batchId: "B1",
  status: "Created",
  stage: "Farm",
  custodian: OTHER,
  pendingTarget: NOBODY,
  destination: NOBODY,
  ...over,
});

test("session and login responses carry isAdmin and the token expiry", () => {
  const session = {
    address: ME,
    roles: ["MILL"],
    isAdmin: true,
    expiresAt: "2026-10-30T12:00:00.000Z",
  };
  assert.ok(sessionSchema.safeParse(session).success);
  assert.ok(
    loginResponseSchema.safeParse({ ...session, token: "a.b.c" }).success,
  );
  // Both fields are required on a session...
  assert.equal(
    sessionSchema.safeParse({ address: ME, roles: [] }).success,
    false,
  );
  // ...but the public roles lookup stays as it was.
  assert.ok(
    participantRolesResponseSchema.safeParse({ address: ME, roles: [] })
      .success,
  );
});

test("parseMineQuery accepts only true, false or nothing", () => {
  assert.equal(parseMineQuery(undefined), false);
  assert.equal(parseMineQuery("false"), false);
  assert.equal(parseMineQuery("true"), true);
  for (const bad of ["1", "yes", "TRUE", ""]) {
    assert.throws(() => parseMineQuery(bad), { status: 400 });
  }
});

test("classifyBatchForParticipant sorts a batch by who holds it", () => {
  assert.equal(
    classifyBatchForParticipant(batch({ custodian: ME }), ME),
    "holding",
  );
  assert.equal(
    classifyBatchForParticipant(batch({ custodian: ME.toLowerCase() }), ME),
    "holding",
  );
  assert.equal(
    classifyBatchForParticipant(batch({ custodian: ME, status: "Listed" }), ME),
    "listedByMe",
  );
  // A transporter that named the facility still holds the batch.
  assert.equal(
    classifyBatchForParticipant(
      batch({ custodian: ME, status: "PendingHandover", pendingTarget: OTHER }),
      ME,
    ),
    "holding",
  );
  // The named facility sees it as waiting for its confirmation.
  assert.equal(
    classifyBatchForParticipant(
      batch({ status: "PendingHandover", pendingTarget: ME }),
      ME,
    ),
    "awaitingMyConfirmation",
  );
  // Someone else's batch, or a batch that does not exist, is not listed.
  assert.equal(classifyBatchForParticipant(batch({}), ME), null);
  assert.equal(
    classifyBatchForParticipant(batch({ custodian: ME, status: "None" }), ME),
    null,
  );
  assert.equal(classifyBatchForParticipant(undefined, ME), null);
  assert.equal(
    classifyBatchForParticipant(batch({ status: "PendingHandover" }), NOBODY),
    null,
  );
});

test("updateProfileSchema takes any subset of fields but not none", () => {
  assert.ok(updateProfileSchema.safeParse({ name: "New name" }).success);
  assert.ok(
    updateProfileSchema.safeParse({
      contactPhone: "+970 59 111 1111",
      email: "a@example.test",
      details: { vehicleDetails: "Truck" },
    }).success,
  );
  assert.equal(updateProfileSchema.safeParse({}).success, false);
  assert.equal(updateProfileSchema.safeParse({ name: "   " }).success, false);
  assert.equal(updateProfileSchema.safeParse({ email: "nope" }).success, false);
  // Availability has its own endpoint: sent alone it leaves nothing to
  // update, and sent beside other fields it is ignored rather than applied.
  assert.equal(
    updateProfileSchema.safeParse({ availability: "available" }).success,
    false,
  );
  assert.equal(
    "availability" in
      updateProfileSchema.parse({ name: "x", availability: "available" }),
    false,
  );
});

test("updateAvailabilitySchema allows available and unavailable only", () => {
  assert.ok(
    updateAvailabilitySchema.safeParse({ availability: "available" }).success,
  );
  assert.ok(
    updateAvailabilitySchema.safeParse({ availability: "unavailable" }).success,
  );
  for (const bad of ["busy", "", undefined, 1]) {
    assert.equal(
      updateAvailabilitySchema.safeParse({ availability: bad }).success,
      false,
    );
  }
});

test("the new response schemas accept what the services return", () => {
  assert.ok(
    publicProfileResponseSchema.safeParse({
      address: ME,
      name: "Al-Salam Olive Mill",
      location: null,
      roles: ["MILL"],
    }).success,
  );
  assert.ok(
    myProfileResponseSchema.safeParse({
      address: ME,
      roles: ["MILL"],
      profile: {
        name: "Mill",
        contactPhone: null,
        email: null,
        address: null,
        location: "Jenin",
        availability: "available",
        details: { facilityName: "Mill" },
      },
    }).success,
  );
  assert.ok(
    availabilityResponseSchema.safeParse({
      address: ME,
      availability: "available",
    }).success,
  );
  assert.ok(
    myBatchesResponseSchema.safeParse({
      holding: [batch({})],
      listedByMe: [],
      awaitingMyConfirmation: [],
    }).success,
  );
  assert.ok(
    adminParticipantsResponseSchema.safeParse({
      participants: [
        {
          address: ME,
          name: null,
          location: null,
          availability: null,
          roles: [],
        },
      ],
    }).success,
  );
});

test("a participant is available unless they chose unavailable", () => {
  assert.equal(isAvailable("available"), true);
  assert.equal(isAvailable(null), true);
  assert.equal(isAvailable(undefined), true);
  assert.equal(isAvailable("unavailable"), false);
});
