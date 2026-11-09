import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubModule, stubReader } from "./support/stubModule.js";

const reader = stubReader();
stubModule("chain/contracts.js", [], {
  provider: {},
  registry: {},
  batchCustody: {},
});
stubModule("config.js", [], { config: { CHAIN_ID: 31337 } });
stubModule("repositories/unitOfWork.js", ["runInTransaction"]);
const batchRepo = stubModule("repositories/batch.repository.js", ["listIds"]);
const participantsRepo = stubModule("repositories/participant.repository.js", [
  "findProfile",
  "listDirectory",
  "listWithNames",
]);
const { countBatchesPerStage } =
  await import("../src/services/stats.service.js");
const { listParticipants } = await import("../src/services/admin.service.js");
const { listBatchDestinations, listDestinationsForRole } =
  await import("../src/services/destination.service.js");
const { getPublicProfile } =
  await import("../src/services/participant.service.js");

const ADMIN = "0xAAAA000000000000000000000000000000000001";
const FARMER = "0xbbbb000000000000000000000000000000000002";
const MILL_A = "0xcccc000000000000000000000000000000000003";
const MILL_B = "0xdddd000000000000000000000000000000000004";
const STORAGE = "0xeeee000000000000000000000000000000000005";
const NOBODY = "0x0000000000000000000000000000000000000000";

const ROLE_OF = {
  [FARMER]: ["FARMER"],
  [MILL_A]: ["MILL"],
  [MILL_B]: ["MILL"],
  [STORAGE]: ["STORAGE"],
};
let chain;
beforeEach(() => {
  chain = {};
  reader.hasAdminRole = async (address) => address === ADMIN;
  reader.hasRole = async (role, address) =>
    (ROLE_OF[address.toLowerCase()] ?? []).includes(role);
  reader.getBatch = async (batchId) =>
    chain[batchId] ?? { status: "None", stage: "Farm", custodian: NOBODY };
  participantsRepo.listWithNames = async () => [
    { address: MILL_A, name: "Mill A", availability: "available" },
    { address: MILL_B, name: "Mill B", availability: "unavailable" },
    { address: STORAGE, name: "Store", availability: null },
    { address: FARMER, name: "Farm", availability: null },
  ];
});

test("countBatchesPerStage counts saved batches by chain stage", async () => {
  const ids = Array.from({ length: 30 }, (_, i) => `B${i}`);
  batchRepo.listIds = async () => ids.map((batchId) => ({ batchId }));
  ids.forEach((id, i) => {
    if (i === 0) return;
    chain[id] = { status: "Created", stage: i < 20 ? "Mill" : "Retailer" };
  });
  const { stages } = await countBatchesPerStage({ address: ADMIN });
  assert.deepEqual(stages, [
    { stage: "Farm", count: 0 },
    { stage: "Mill", count: 19 },
    { stage: "Storage", count: 0 },
    { stage: "Exporter", count: 0 },
    { stage: "Importer", count: 0 },
    { stage: "Retailer", count: 10 },
  ]);
});

test("countBatchesPerStage is a 403 for a non-admin and a 500 on chain failure", async () => {
  await assert.rejects(countBatchesPerStage({ address: FARMER }), {
    status: 403,
  });
  batchRepo.listIds = async () => [{ batchId: "B1" }];
  reader.getBatch = async () => {
    throw new Error("rpc down");
  };
  await assert.rejects(countBatchesPerStage({ address: ADMIN }), {
    status: 500,
  });
});

test("listParticipants pages the directory before reading roles", async () => {
  const roleReads = [];
  reader.hasRole = async (role, address) => {
    roleReads.push(address);
    return (ROLE_OF[address] ?? []).includes(role);
  };
  participantsRepo.listDirectory = async () => [
    { address: FARMER, name: "Farm", location: null, availability: null },
    {
      address: MILL_A,
      name: "Mill A",
      location: "Nablus",
      availability: "available",
    },
    { address: STORAGE, name: null, location: null, availability: null },
  ];
  const { participants } = await listParticipants(
    { address: ADMIN },
    { limit: "1", offset: "1" },
  );
  assert.deepEqual(participants, [
    {
      address: MILL_A,
      name: "Mill A",
      location: "Nablus",
      availability: "available",
      roles: ["MILL"],
    },
  ]);
  assert.deepEqual([...new Set(roleReads)], [MILL_A]);
  await assert.rejects(listParticipants({ address: FARMER }, {}), {
    status: 403,
  });
  await assert.rejects(listParticipants({ address: ADMIN }, { offset: "x" }), {
    status: 400,
  });
});

test("listDestinationsForRole leaves out unavailable mills", async () => {
  assert.deepEqual(await listDestinationsForRole("mill"), {
    role: "MILL",
    destinations: [{ address: MILL_A, name: "Mill A", role: "MILL" }],
  });
  await assert.rejects(listDestinationsForRole("STORAGE"), { status: 400 });
});

test("listBatchDestinations offers the next stage to the custodian only", async () => {
  chain.B1 = { status: "Created", stage: "Mill", custodian: MILL_A };
  const result = await listBatchDestinations({ address: MILL_A }, "B1");
  assert.deepEqual(result, {
    batchId: "B1",
    stage: "Mill",
    role: "STORAGE",
    destinations: [{ address: STORAGE, name: "Store", role: "STORAGE" }],
  });
  await assert.rejects(listBatchDestinations({ address: FARMER }, "B1"), {
    status: 403,
  });
  await assert.rejects(listBatchDestinations({ address: MILL_A }, "NONE"), {
    status: 404,
  });
  chain.B2 = { status: "Listed", stage: "Mill", custodian: MILL_A };
  await assert.rejects(listBatchDestinations({ address: MILL_A }, "B2"), {
    status: 409,
  });
  chain.B3 = { status: "Created", stage: "Retailer", custodian: MILL_A };
  await assert.rejects(listBatchDestinations({ address: MILL_A }, "B3"), {
    status: 409,
  });
});

test("getPublicProfile hides contact details", async () => {
  participantsRepo.findProfile = async () => ({
    name: "Mill A",
    location: "Nablus",
    email: "secret@example.com",
    contactPhone: "123",
  });
  assert.deepEqual(await getPublicProfile(MILL_A), {
    address: MILL_A,
    name: "Mill A",
    location: "Nablus",
    roles: ["MILL"],
  });
  participantsRepo.findProfile = async () => undefined;
  await assert.rejects(getPublicProfile(MILL_A), { status: 404 });
  await assert.rejects(getPublicProfile("not-an-address"), { status: 400 });
});
