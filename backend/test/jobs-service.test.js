import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubModule, stubReader } from "./support/stubModule.js";

const reader = stubReader();
const jobsRepo = stubModule("db/repositories/transporterJob.repository.js", [
  "listAvailable",
  "listActiveForTransporter",
  "listCompletedForTransporter",
  "findById",
]);
const eventsRepo = stubModule("db/repositories/batchEvent.repository.js", [
  "findByTxHashes",
]);
const participantsRepo = stubModule(
  "db/repositories/participant.repository.js",
  ["listWithNamesByWallets"],
);
const { getJobView, listJobs } =
  await import("../src/services/jobs.service.js");
const { parseJobId } = await import("../src/validation/parse.js");
const { jobResponseSchema } =
  await import("../src/validation/response.schemas.js");

const CALLER = "0xAAAA000000000000000000000000000000000001";
const FARM = "0xbbbb000000000000000000000000000000000002";
const MILL = "0xcccc000000000000000000000000000000000003";
const EXPORTER = "0xdddd000000000000000000000000000000000004";
const IMPORTER = "0xeeee000000000000000000000000000000000005";
const tx = (n) => `0x${String(n).repeat(64)}`;
const user = { address: CALLER };

const job = (
  id,
  batchId,
  sourceParty,
  destinationParty,
  status = "available",
) => ({
  id,
  status,
  batchId,
  sourceParty,
  destinationParty,
  listingTxHash: tx(id),
  createdAt: new Date(Date.UTC(2026, 10, id)),
});
const JOBS = [
  job(1, "A", FARM, MILL),
  job(2, "B", FARM, MILL),
  job(3, "C", EXPORTER, IMPORTER),
];
const CHAIN = {
  A: { status: "Listed", stage: "Farm", custodian: FARM },
  B: { status: "Created", stage: "Farm", custodian: CALLER },
  C: { status: "Listed", stage: "Exporter", custodian: EXPORTER },
};
const ROLE_OF = {
  [CALLER.toLowerCase()]: "TRANSPORTER",
  [FARM]: "FARMER",
  [MILL]: "MILL",
  [EXPORTER]: "EXPORTER",
  [IMPORTER]: "IMPORTER",
};

let chainReads;
let repoCalls;
beforeEach(() => {
  chainReads = [];
  repoCalls = [];
  reader.hasRole = async (role, address) =>
    ROLE_OF[address.toLowerCase()] === role;
  reader.getBatch = async (batchId) => {
    chainReads.push(batchId);
    return CHAIN[batchId];
  };
  jobsRepo.listAvailable = async () => {
    repoCalls.push(["listAvailable"]);
    return JOBS;
  };
  jobsRepo.listActiveForTransporter = async (address) => {
    repoCalls.push(["listActiveForTransporter", address]);
    return JOBS;
  };
  jobsRepo.listCompletedForTransporter = async (address) => {
    repoCalls.push(["listCompletedForTransporter", address]);
    return [job(9, "A", FARM, MILL, "completed")];
  };
  eventsRepo.findByTxHashes = async () => [
    {
      eventTxHash: tx(1),
      detailsType: "farm",
      details: {
        quantity: 1200.5,
        olive_type: "Nabali",
        harvest_date: "2026-10-01",
        cultivation_method: "organic",
      },
    },
    {
      eventTxHash: tx(3),
      detailsType: "exporter_outgoing",
      details: { quantity_shipped: 19.8, shipment_details: "container" },
    },
  ];
  participantsRepo.listWithNamesByWallets = async () => [
    { walletAddress: FARM, name: "Olive Farm" },
    { walletAddress: MILL, name: "Press Mill" },
  ];
});

test("listJobs refuses a caller without the TRANSPORTER role", async () => {
  await assert.rejects(listJobs({ address: FARM }, {}), { status: 403 });
});

test("listJobs rejects a bad query before reading the chain", async () => {
  reader.hasRole = async () => assert.fail("must not read roles");
  await assert.rejects(listJobs(user, { mine: "yes" }), { status: 400 });
  await assert.rejects(listJobs(user, { status: "completed" }), {
    status: 400,
  });
  await assert.rejects(listJobs(user, { limit: "0" }), { status: 400 });
});

test("the open board keeps only batches still listed by their poster", async () => {
  const { jobs } = await listJobs(user, {});
  assert.deepEqual(
    jobs.map((j) => j.id),
    [1, 3],
  );
  const [farmJob, exporterJob] = jobs;
  assert.equal(farmJob.stage, "Farm");
  assert.deepEqual(farmJob.source, {
    name: "Olive Farm",
    role: "FARMER",
    roles: ["FARMER"],
  });
  assert.deepEqual(farmJob.destination, {
    name: "Press Mill",
    role: "MILL",
    roles: ["MILL"],
    address: MILL,
  });
  assert.deepEqual(farmJob.outgoingDetails, {
    quantity: 1200.5,
    oliveType: "Nabali",
    harvestDate: "2026-10-01",
  });
  assert.deepEqual(exporterJob.outgoingDetails, {
    quantityShipped: 19.8,
    shipmentDetails: "container",
    productCondition: null,
    packagingCondition: null,
    notes: null,
  });
  assert.equal(exporterJob.destination.name, null);
});

test("the open board pages after filtering", async () => {
  const { jobs } = await listJobs(user, { limit: "1", offset: "1" });
  assert.deepEqual(
    jobs.map((j) => j.id),
    [3],
  );
});

test("mine=true lists the caller's jobs without the listed filter", async () => {
  const { jobs } = await listJobs(user, { mine: "true" });
  assert.deepEqual(repoCalls, [
    ["listActiveForTransporter", CALLER.toLowerCase()],
  ]);
  assert.deepEqual(
    jobs.map((j) => j.id),
    [1, 2, 3],
  );
});

test("mine=true pages before reading the chain", async () => {
  const { jobs } = await listJobs(user, { mine: "true", limit: "1" });
  assert.deepEqual(
    jobs.map((j) => j.id),
    [1],
  );
  assert.deepEqual(chainReads, ["A"]);
});

test("status=completed lists the caller's completed jobs", async () => {
  const { jobs } = await listJobs(user, { mine: "true", status: "completed" });
  assert.deepEqual(repoCalls, [
    ["listCompletedForTransporter", CALLER.toLowerCase()],
  ]);
  assert.equal(jobs[0].status, "completed");
});

test("an empty list skips every chain read", async () => {
  jobsRepo.listAvailable = async () => [];
  assert.deepEqual(await listJobs(user, {}), { jobs: [] });
  assert.deepEqual(chainReads, []);
});

test("a chain failure becomes a 500", async () => {
  reader.getBatch = async () => {
    throw new Error("rpc down");
  };
  await assert.rejects(listJobs(user, {}), {
    status: 500,
    message: "job lookup failed",
  });
});

test("getJobView returns one job in the board shape, whatever its chain state", async () => {
  jobsRepo.findById = async (id) =>
    id === 2
      ? {
          ...JOBS[1],
          status: "reserved",
          reservedAt: new Date("2026-11-10T08:00:00Z"),
        }
      : null;
  const view = await getJobView(2);
  assert.equal(view.id, 2);
  assert.equal(view.status, "reserved");
  assert.equal(view.stage, "Farm");
  assert.ok(view.reservedAt instanceof Date);
  assert.ok(jobResponseSchema.safeParse(view).success);
  assert.equal(await getJobView(99), null);
});

test("parseJobId accepts positive integer ids only", () => {
  assert.equal(parseJobId("7"), 7);
  for (const bad of ["0", "-1", "1.5", "abc", "", undefined, ["1"]]) {
    assert.throws(() => parseJobId(bad), { status: 400 });
  }
});
