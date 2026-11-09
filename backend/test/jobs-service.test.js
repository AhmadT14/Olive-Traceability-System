import test, { beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { stubModule, stubReader } from "./support/stubModule.js";

const reader = stubReader();
const jobsRepo = stubModule("repositories/transporterJob.repository.js", [
  "listAvailable",
  "listActiveForTransporter",
  "listCompletedForTransporter",
  "findById",
  "transition",
  "releaseReservation",
]);
const eventsRepo = stubModule("repositories/batchEvent.repository.js", [
  "findByTxHashes",
]);
const participantsRepo = stubModule("repositories/participant.repository.js", [
  "listWithNamesByWallets",
  "findAvailability",
]);
const { listJobs, releaseJob, reserveJob } =
  await import("../src/services/jobs.service.js");

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

describe("reserving and releasing a job", () => {
  let rows;
  let writes;
  beforeEach(() => {
    writes = [];
    rows = { 1: { ...JOBS[0], transporter: null, reservedAt: null } };
    participantsRepo.findAvailability = async () => ({ availability: null });
    jobsRepo.findById = async (id) => rows[id] ?? null;
    jobsRepo.transition = async (id, from, patch) => {
      writes.push(["transition", id, from, patch]);
      if (rows[id]?.status !== from) return [];
      rows[id] = { ...rows[id], ...patch };
      return [{ id }];
    };
    jobsRepo.releaseReservation = async (id, transporter) => {
      writes.push(["release", id, transporter]);
      const row = rows[id];
      if (row?.status !== "reserved" || row.transporter !== transporter) {
        return [];
      }
      rows[id] = {
        ...row,
        status: "available",
        transporter: null,
        reservedAt: null,
      };
      return [{ id }];
    };
  });

  test("reserveJob reserves an open job for the caller", async () => {
    const view = await reserveJob(user, "1");
    assert.equal(writes.length, 1);
    const [, id, from, patch] = writes[0];
    assert.equal(id, 1);
    assert.equal(from, "available");
    assert.equal(patch.status, "reserved");
    assert.equal(patch.transporter, CALLER.toLowerCase());
    assert.ok(patch.reservedAt instanceof Date);
    assert.equal(view.id, 1);
    assert.equal(view.status, "reserved");
    assert.equal(view.reservedAt, patch.reservedAt);
    assert.equal(view.outgoingDetails.oliveType, "Nabali");
  });

  test("reserveJob refuses every case the spec lists", async () => {
    await assert.rejects(reserveJob(user, "abc"), { status: 400 });
    await assert.rejects(reserveJob(user, "0"), { status: 400 });
    await assert.rejects(reserveJob({ address: FARM }, "1"), { status: 403 });
    await assert.rejects(reserveJob(user, "99"), { status: 404 });

    participantsRepo.findAvailability = async () => ({
      availability: "unavailable",
    });
    await assert.rejects(reserveJob(user, "1"), {
      status: 409,
      message: "transporter is marked unavailable",
    });
    participantsRepo.findAvailability = async () => undefined;

    rows[1] = { ...rows[1], status: "claimed" };
    await assert.rejects(reserveJob(user, "1"), {
      status: 409,
      message: "job is not available",
    });

    rows[2] = { ...JOBS[1], transporter: null, reservedAt: null };
    await assert.rejects(reserveJob(user, "2"), {
      status: 409,
      message: "batch is no longer listed for pickup",
    });
    assert.deepEqual(writes, []);
  });

  test("reserveJob loses a race cleanly", async () => {
    jobsRepo.transition = async () => [];
    await assert.rejects(reserveJob(user, "1"), {
      status: 409,
      message: "job is not available",
    });
  });

  test("releaseJob gives the caller's reservation back to the board", async () => {
    await reserveJob(user, "1");
    const view = await releaseJob(user, "1");
    assert.deepEqual(writes[1], ["release", 1, CALLER.toLowerCase()]);
    assert.equal(view.status, "available");
    assert.equal(view.reservedAt, null);
  });

  test("releaseJob refuses a job that is missing, not reserved or someone else's", async () => {
    await assert.rejects(releaseJob(user, "x"), { status: 400 });
    await assert.rejects(releaseJob(user, "99"), { status: 404 });
    await assert.rejects(releaseJob(user, "1"), {
      status: 409,
      message: "job is not reserved",
    });
    rows[1] = { ...rows[1], status: "reserved", transporter: FARM };
    await assert.rejects(releaseJob(user, "1"), { status: 403 });
    assert.deepEqual(writes, []);
  });
});
