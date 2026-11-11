import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyBatchForParticipant,
  isAvailable,
} from "../src/chain/checks.js";
import {
  profileDetailsSchemaForRoles,
  updateAvailabilitySchema,
  updateProfileSchema,
} from "../src/validation/participant.schemas.js";
import {
  pageOf,
  parseJobStatusQuery,
  parseMineQuery,
  parsePageQuery,
} from "../src/validation/parse.js";
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
  reservedBy: NOBODY,
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
  assert.equal(
    sessionSchema.safeParse({ address: ME, roles: [] }).success,
    false,
  );
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

test("profile details of a wallet with several roles keep every role's keys", () => {
  const details = {
    farmName: "Olive Grove",
    vehicleDetails: "refrigerated truck",
    licenseDetails: "TR-1",
  };
  const result = profileDetailsSchemaForRoles(["FARMER", "TRANSPORTER"]).parse(
    details,
  );
  assert.deepEqual(result, details);
  assert.deepEqual(profileDetailsSchemaForRoles(["FARMER"]).parse(details), {
    farmName: "Olive Grove",
  });
  assert.equal(
    profileDetailsSchemaForRoles(["FARMER", "MILL"]).safeParse({
      processingCapacity: false,
    }).success,
    false,
  );
});

test("parseJobStatusQuery accepts completed only together with mine", () => {
  assert.equal(parseJobStatusQuery(undefined, false), undefined);
  assert.equal(parseJobStatusQuery(undefined, true), undefined);
  assert.equal(parseJobStatusQuery("completed", true), "completed");
  assert.throws(() => parseJobStatusQuery("completed", false), { status: 400 });
  for (const bad of ["claimed", "COMPLETED", "", ["completed", "completed"]]) {
    assert.throws(() => parseJobStatusQuery(bad, true), { status: 400 });
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
  // A reserved batch is still listed by its custodian until it is claimed.
  assert.equal(
    classifyBatchForParticipant(
      batch({ custodian: ME, status: "Reserved", reservedBy: OTHER }),
      ME,
    ),
    "listedByMe",
  );
  assert.equal(
    classifyBatchForParticipant(
      batch({ custodian: ME, status: "Reserved", reservedBy: OTHER }),
      OTHER,
    ),
    null,
  );
  // A transporter that named the facility still holds the batch.
  assert.equal(
    classifyBatchForParticipant(
      batch({ custodian: ME, status: "PendingHandover", pendingTarget: OTHER }),
      ME,
    ),
    "holding",
  );
  assert.equal(
    classifyBatchForParticipant(
      batch({ status: "PendingHandover", pendingTarget: ME }),
      ME,
    ),
    "awaitingMyConfirmation",
  );
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

test("parsePageQuery reads an optional limit and offset", () => {
  assert.deepEqual(parsePageQuery({}), { limit: undefined, offset: 0 });
  assert.deepEqual(parsePageQuery(undefined), { limit: undefined, offset: 0 });
  assert.deepEqual(parsePageQuery({ limit: "10", offset: "20" }), {
    limit: 10,
    offset: 20,
  });
  assert.deepEqual(parsePageQuery({ offset: "5" }), {
    limit: undefined,
    offset: 5,
  });
  for (const limit of ["0", "101", "-1", "1.5", "ten", "", ["10", "20"]]) {
    assert.throws(() => parsePageQuery({ limit }), { status: 400 });
  }
  for (const offset of ["-1", "1.5", "x", "", ["1"]]) {
    assert.throws(() => parsePageQuery({ offset }), { status: 400 });
  }
});

test("pageOf slices a list by limit and offset", () => {
  const items = [1, 2, 3, 4, 5];
  assert.deepEqual(pageOf(items, { limit: undefined, offset: 0 }), items);
  assert.deepEqual(pageOf(items, { limit: 2, offset: 0 }), [1, 2]);
  assert.deepEqual(pageOf(items, { limit: 2, offset: 3 }), [4, 5]);
  assert.deepEqual(pageOf(items, { limit: undefined, offset: 4 }), [5]);
  assert.deepEqual(pageOf(items, { limit: 2, offset: 9 }), []);
});
