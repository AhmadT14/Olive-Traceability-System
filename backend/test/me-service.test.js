import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubModule, stubReader } from "./support/stubModule.js";

const reader = stubReader();
const eventsRepo = stubModule("repositories/batchEvent.repository.js", [
  "findFarmEventsByTxHashes",
]);
const batchRepo = stubModule("repositories/batch.repository.js", ["listIds"]);
const participantsRepo = stubModule("repositories/participant.repository.js", [
  "findProfile",
  "updateProfile",
]);
const jobsRepo = stubModule("repositories/transporterJob.repository.js", [
  "listReceivedByParty",
]);
const {
  getMyProfile,
  listCreatedBatches,
  listMyBatches,
  listReceivedBatches,
  updateMyAvailability,
  updateMyProfile,
} = await import("../src/services/me.service.js");

const ME = "0xAAAA000000000000000000000000000000000001";
const OTHER = "0xbbbb000000000000000000000000000000000002";
const NOBODY = "0x0000000000000000000000000000000000000000";
const user = { address: ME };
const tx = (n) => `0x${String(n).repeat(64)}`;

let roles;
let profile;
let writes;
let chainReads;
beforeEach(() => {
  roles = ["FARMER"];
  profile = { name: "Olive Farm", details: { farmName: "Olive Farm" } };
  writes = [];
  chainReads = [];
  reader.hasRole = async (role) => roles.includes(role);
  reader.getBatch = async (batchId) => {
    chainReads.push(batchId);
    return {
      status: "Listed",
      stage: "Farm",
      custodian: ME,
      pendingTarget: NOBODY,
      destination: OTHER,
    };
  };
  participantsRepo.findProfile = async () => profile;
  participantsRepo.updateProfile = async (wallet, patch) => {
    writes.push([wallet, patch]);
    return { ...profile, ...patch };
  };
});

test("getMyProfile returns the profile with the caller's chain roles", async () => {
  roles = ["FARMER", "TRANSPORTER"];
  const view = await getMyProfile(user);
  assert.equal(view.address, ME.toLowerCase());
  assert.deepEqual(view.roles, ["FARMER", "TRANSPORTER"]);
  assert.equal(view.profile.name, "Olive Farm");
  assert.equal(view.profile.email, null);
});

test("getMyProfile is a 404 without a saved profile", async () => {
  participantsRepo.findProfile = async () => undefined;
  await assert.rejects(getMyProfile(user), { status: 404 });
});

test("updateMyProfile keeps the details of every role the wallet holds", async () => {
  roles = ["FARMER", "TRANSPORTER"];
  profile = {
    name: "Olive Farm",
    details: { farmName: "Old name", vehicleDetails: "refrigerated truck" },
  };
  await updateMyProfile(user, { details: { farmName: "New name" } });
  assert.deepEqual(writes, [
    [
      ME.toLowerCase(),
      {
        details: {
          farmName: "New name",
          vehicleDetails: "refrigerated truck",
        },
      },
    ],
  ]);
});

test("updateMyProfile drops detail keys that belong to no held role", async () => {
  profile = { name: "Olive Farm", details: { storageCapacity: 50 } };
  await updateMyProfile(user, { details: { farmName: "Grove" } });
  assert.deepEqual(writes[0][1].details, { farmName: "Grove" });
});

test("updateMyProfile leaves details alone when they are not sent", async () => {
  await updateMyProfile(user, { name: "Renamed" });
  assert.deepEqual(writes, [[ME.toLowerCase(), { name: "Renamed" }]]);
});

test("updateMyProfile refuses bad input", async () => {
  await assert.rejects(updateMyProfile(user, {}), { status: 422 });
  await assert.rejects(updateMyProfile(user, { details: { farmName: 42 } }), {
    status: 422,
  });
  roles = [];
  await assert.rejects(updateMyProfile(user, { details: { farmName: "x" } }), {
    status: 403,
  });
  assert.deepEqual(writes, []);
});

test("updateMyAvailability writes only a known value", async () => {
  await assert.rejects(updateMyAvailability(user, { availability: "busy" }), {
    status: 422,
  });
  assert.deepEqual(
    await updateMyAvailability(user, { availability: "unavailable" }),
    {
      address: ME.toLowerCase(),
      availability: "unavailable",
    },
  );
  assert.deepEqual(writes, [
    [ME.toLowerCase(), { availability: "unavailable" }],
  ]);
});

test("listMyBatches sorts batches by who holds them", async () => {
  batchRepo.listIds = async () => [{ batchId: "A" }, { batchId: "B" }];
  reader.getBatch = async (batchId) =>
    batchId === "A"
      ? {
          status: "Listed",
          stage: "Farm",
          custodian: ME,
          pendingTarget: NOBODY,
        }
      : {
          status: "Created",
          stage: "Mill",
          custodian: OTHER,
          pendingTarget: NOBODY,
        };
  const result = await listMyBatches(user);
  assert.deepEqual(
    result.listedByMe.map((b) => b.batchId),
    ["A"],
  );
  assert.deepEqual(result.holding, []);
  assert.deepEqual(result.awaitingMyConfirmation, []);
});

const createdFixture = () => {
  reader.getBatchCreatedEvents = async () => [
    { txHash: tx(1), blockNumber: 10, timestamp: 1_700_000_000 },
    { txHash: tx(2), blockNumber: 20, timestamp: 1_700_000_100 },
  ];
  eventsRepo.findFarmEventsByTxHashes = async () => [
    {
      eventTxHash: tx(1),
      batchId: "OLD",
      details: {
        harvest_date: "2026-09-01",
        quantity: "800",
        olive_type: "Souri",
      },
    },
    {
      eventTxHash: tx(2),
      batchId: "NEW",
      details: { harvest_date: "2026-10-01" },
    },
  ];
};

test("listCreatedBatches adds quantity and olive_type from the farm record", async () => {
  createdFixture();
  const { batches } = await listCreatedBatches(user, {});
  assert.deepEqual(
    batches.map((b) => [b.batchId, b.quantity, b.olive_type]),
    [
      ["NEW", null, null],
      ["OLD", "800", "Souri"],
    ],
  );
  assert.equal(batches[1].harvestDate, "2026-09-01");
  assert.equal(batches[1].status, "Listed");
});

test("listCreatedBatches pages before reading the chain", async () => {
  createdFixture();
  const { batches } = await listCreatedBatches(user, {
    limit: "1",
    offset: "1",
  });
  assert.deepEqual(
    batches.map((b) => b.batchId),
    ["OLD"],
  );
  assert.deepEqual(chainReads, ["OLD"]);
});

test("listCreatedBatches is a 403 for a non-farmer", async () => {
  roles = ["MILL"];
  await assert.rejects(listCreatedBatches(user, {}), { status: 403 });
});

test("listReceivedBatches reads the caller's saved receipts", async () => {
  const asked = [];
  jobsRepo.listReceivedByParty = async (party, page) => {
    asked.push([party, page]);
    return [
      {
        batchId: "B1",
        txHash: tx(3),
        receivedAt: new Date("2026-11-02T10:00:00Z"),
        details: { quantity_received: 99.5 },
      },
      {
        batchId: "B2",
        txHash: tx(4),
        receivedAt: "2026-11-01T09:00:00Z",
        details: {},
      },
    ];
  };
  const { batches } = await listReceivedBatches(user, {
    limit: "5",
    offset: "2",
  });
  assert.deepEqual(asked, [[ME.toLowerCase(), { limit: 5, offset: 2 }]]);
  assert.deepEqual(batches, [
    {
      batchId: "B1",
      txHash: tx(3),
      receivedAt: "2026-11-02T10:00:00.000Z",
      quantityReceived: 99.5,
    },
    {
      batchId: "B2",
      txHash: tx(4),
      receivedAt: "2026-11-01T09:00:00.000Z",
      quantityReceived: null,
    },
  ]);
});

test("listReceivedBatches turns a database failure into a 500", async () => {
  jobsRepo.listReceivedByParty = async () => {
    throw new Error("db down");
  };
  await assert.rejects(listReceivedBatches(user, {}), { status: 500 });
});
