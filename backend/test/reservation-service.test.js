import test, { beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import { id } from "ethers";
import { stubModule, stubReader } from "./support/stubModule.js";
import {
  checkCanClaimBatch,
  checkCanReleaseBatch,
  checkCanReserveBatch,
} from "../src/chain/checks.js";
import { isListedForPickup, Status } from "../src/chain/enums.js";

const CUSTODY = "0x00000000000000000000000000000000000000c0";
stubModule("config.js", [], { config: { BATCH_CUSTODY_ADDRESS: CUSTODY } });
const encoded = [];
stubModule("chain/contracts.js", [], {
  batchCustody: {
    interface: {
      encodeFunctionData: (name, args) => {
        encoded.push([name, ...args]);
        return "0xdata";
      },
    },
  },
});
const transaction = stubModule("services/transaction.js", [
  "prepareTransaction",
]);
const reader = stubReader();
const participants = stubModule("db/repositories/participant.repository.js", [
  "findAvailability",
]);
const jobs = stubModule("db/repositories/transporterJob.repository.js", [
  "findById",
  "findClaimableForTransporter",
  "transition",
  "releaseReservation",
]);
const views = stubModule("services/jobs.service.js", ["getJobView"]);
const drafts = stubModule("db/repositories/pendingSave.repository.js", [
  "insert",
  "findPendingByBatchAndHash",
  "resolve",
]);
const events = stubModule("db/repositories/batchEvent.repository.js", [
  "insert",
]);
const unitOfWork = stubModule("db/repositories/unitOfWork.js", [
  "runInTransaction",
]);

const { confirmRelease, confirmReserve, prepareRelease, prepareReserve } =
  await import("../src/services/reservation.service.js");
const { prepareClaim } = await import("../src/services/prepare.service.js");
const { writeClaim } = await import("../src/services/transporter.service.js");

const TRANSPORTER = "0xAAAA000000000000000000000000000000000001";
const FARM = "0xbbbb000000000000000000000000000000000002";
const MILL = "0xcccc000000000000000000000000000000000003";
const OTHER = "0xdddd000000000000000000000000000000000004";
const ZERO = "0x0000000000000000000000000000000000000000";
const TX = `0x${"A".repeat(64)}`;
const EXEC = "exec";
const user = { address: TRANSPORTER };

const JOB = {
  id: 7,
  status: "available",
  batchId: "B1",
  sourceParty: FARM,
  destinationParty: MILL,
  transporter: null,
  listingTxHash: `0x${"1".repeat(64)}`,
  reservedAt: null,
  createdAt: new Date("2026-11-10T08:00:00Z"),
};
const listed = {
  status: "Listed",
  stage: "Farm",
  custodian: FARM,
  pendingTarget: ZERO,
  destination: MILL,
  reservedBy: ZERO,
};
const reservedByCaller = {
  ...listed,
  status: "Reserved",
  reservedBy: TRANSPORTER,
};

const event = (name, args, batchId = "B1") => ({
  name,
  topics: ["0x", id(batchId)],
  args,
});
const mined = (...events) => ({ success: true, blockNumber: 1, events });

let calls;
beforeEach(() => {
  calls = [];
  encoded.length = 0;
  reader.hasRole = async (role, address) =>
    role === "TRANSPORTER" &&
    address.toLowerCase() === TRANSPORTER.toLowerCase();
  reader.getBatch = async () => listed;
  reader.decodeCustodyTx = async () =>
    mined(event("BatchReserved", { transporter: TRANSPORTER }));
  participants.findAvailability = async () => ({ availability: "available" });
  jobs.findById = async (jobId) => (jobId === 7 ? JOB : null);
  jobs.findClaimableForTransporter = async (...args) => {
    calls.push(["findClaimableForTransporter", ...args]);
    return {
      id: 7,
      status: "reserved",
      transporter: TRANSPORTER.toLowerCase(),
    };
  };
  jobs.transition = async (...args) => {
    calls.push(["transition", ...args]);
    return [{ id: 7 }];
  };
  jobs.releaseReservation = async (...args) => {
    calls.push(["releaseReservation", ...args]);
    return [{ id: 7 }];
  };
  views.getJobView = async (jobId) => ({ id: jobId, status: "view" });
  transaction.prepareTransaction = async (_user, to, data) => ({
    to,
    data,
    value: "0x0",
  });
  drafts.insert = async () => [{ id: 1 }];
  drafts.findPendingByBatchAndHash = async () => [];
  drafts.resolve = async () => [];
  events.insert = async (...args) => {
    calls.push(["event.insert", ...args]);
  };
  unitOfWork.runInTransaction = (work) => work(EXEC);
});

test("the chain enums know the reserved status", () => {
  assert.deepEqual(Status, [
    "None",
    "Created",
    "Listed",
    "PendingHandover",
    "Reserved",
  ]);
  assert.equal(isListedForPickup(listed), true);
  assert.equal(isListedForPickup(reservedByCaller), true);
  assert.equal(isListedForPickup({ status: "Created" }), false);
});

test("the checks follow the contract's reservation rules", () => {
  assert.deepEqual(
    checkCanReserveBatch({ batch: listed, role: "TRANSPORTER" }),
    {
      allowed: true,
      reason: null,
    },
  );
  assert.equal(
    checkCanReserveBatch({ batch: listed, role: "MILL" }).reason,
    "caller is not a transporter",
  );
  assert.equal(
    checkCanReserveBatch({ batch: reservedByCaller, role: "TRANSPORTER" })
      .reason,
    "batch not listed for pickup",
  );

  assert.equal(
    checkCanReleaseBatch({ batch: listed, actor: TRANSPORTER }).reason,
    "batch not reserved",
  );
  assert.equal(
    checkCanReleaseBatch({ batch: reservedByCaller, actor: OTHER }).reason,
    "caller cannot release this reservation",
  );
  assert.ok(
    checkCanReleaseBatch({ batch: reservedByCaller, actor: TRANSPORTER })
      .allowed,
  );
  assert.ok(
    checkCanReleaseBatch({ batch: reservedByCaller, actor: FARM }).allowed,
  );

  assert.equal(
    checkCanClaimBatch({
      batch: listed,
      actor: TRANSPORTER,
      role: "TRANSPORTER",
    }).reason,
    "batch not reserved for pickup",
  );
  assert.equal(
    checkCanClaimBatch({
      batch: reservedByCaller,
      actor: OTHER,
      role: "TRANSPORTER",
    }).reason,
    "batch reserved by another transporter",
  );
  assert.ok(
    checkCanClaimBatch({
      batch: reservedByCaller,
      actor: TRANSPORTER.toLowerCase(),
      role: "TRANSPORTER",
    }).allowed,
  );
});

describe("prepareReserve", () => {
  test("rejects a bad job id before reading the chain", async () => {
    reader.hasRole = async () => assert.fail("must not read roles");
    await assert.rejects(prepareReserve(user, "x"), { status: 400 });
  });

  test("refuses a caller without the TRANSPORTER role", async () => {
    await assert.rejects(prepareReserve({ address: FARM }, "7"), {
      status: 403,
      message: "caller is not a transporter",
    });
  });

  test("refuses an unavailable transporter before looking at the job", async () => {
    participants.findAvailability = async () => ({
      availability: "unavailable",
    });
    jobs.findById = async () => assert.fail("must not read the job");
    await assert.rejects(prepareReserve(user, "7"), {
      status: 409,
      message: "transporter is marked unavailable",
    });
  });

  test("404 for an unknown job, 409 for one that is not available", async () => {
    await assert.rejects(prepareReserve(user, "8"), { status: 404 });
    jobs.findById = async () => ({ ...JOB, status: "reserved" });
    await assert.rejects(prepareReserve(user, "7"), {
      status: 409,
      message: "job is not available",
    });
  });

  test("409 when the batch is not listed, or listed by someone else now", async () => {
    reader.getBatch = async () => reservedByCaller;
    await assert.rejects(prepareReserve(user, "7"), {
      status: 409,
      message: "batch not listed for pickup",
    });
    reader.getBatch = async () => ({ ...listed, custodian: OTHER });
    await assert.rejects(prepareReserve(user, "7"), {
      status: 409,
      message: "batch is no longer listed by this job's source",
    });
    assert.deepEqual(encoded, []);
  });

  test("prepares reserveBatch for the job's batch", async () => {
    assert.deepEqual(await prepareReserve(user, "7"), {
      id: 7,
      batchId: "B1",
      transaction: { to: CUSTODY, data: "0xdata", value: "0x0" },
    });
    assert.deepEqual(encoded, [["reserveBatch", "B1"]]);
  });

  test("a chain failure becomes a 500", async () => {
    reader.getBatch = async () => {
      throw new Error("rpc down");
    };
    await assert.rejects(prepareReserve(user, "7"), {
      status: 500,
      message: "job reservation failed",
    });
  });
});

describe("prepareRelease", () => {
  const reservedJob = () => ({
    ...JOB,
    status: "reserved",
    transporter: TRANSPORTER.toLowerCase(),
  });

  test("409 for a job that is not reserved", async () => {
    await assert.rejects(prepareRelease(user, "7"), {
      status: 409,
      message: "job is not reserved",
    });
  });

  test("409 when the chain shows no reservation", async () => {
    jobs.findById = async () => reservedJob();
    await assert.rejects(prepareRelease(user, "7"), {
      status: 409,
      message: "batch not reserved",
    });
  });

  test("403 for a wallet that is neither the reserver nor the listing facility", async () => {
    jobs.findById = async () => reservedJob();
    reader.getBatch = async () => reservedByCaller;
    await assert.rejects(prepareRelease({ address: OTHER }, "7"), {
      status: 403,
      message: "caller cannot release this reservation",
    });
    await assert.rejects(prepareRelease({ address: MILL }, "7"), {
      status: 403,
    });
    assert.deepEqual(encoded, []);
  });

  test("prepares releaseBatch for the reserver and for the facility, whatever their roles", async () => {
    jobs.findById = async () => reservedJob();
    reader.getBatch = async () => reservedByCaller;
    reader.hasRole = async () => false;
    for (const address of [
      TRANSPORTER,
      FARM.toUpperCase().replace("0X", "0x"),
    ]) {
      assert.deepEqual(await prepareRelease({ address }, "7"), {
        id: 7,
        batchId: "B1",
        transaction: { to: CUSTODY, data: "0xdata", value: "0x0" },
      });
    }
    assert.deepEqual(encoded, [
      ["releaseBatch", "B1"],
      ["releaseBatch", "B1"],
    ]);
  });
});

describe("confirmReserve", () => {
  test("400 without a body, 422 without a tx hash, 403 without the role", async () => {
    await assert.rejects(confirmReserve(user, "7", undefined), { status: 400 });
    await assert.rejects(confirmReserve(user, "7", {}), { status: 422 });
    await assert.rejects(confirmReserve(user, "7", { txHash: "0x1" }), {
      status: 422,
    });
    await assert.rejects(
      confirmReserve({ address: FARM }, "7", { txHash: TX }),
      {
        status: 403,
      },
    );
  });

  test("404 when the tx is missing, failed or has no BatchReserved for this batch", async () => {
    const message = "tx not found or has no BatchReserved event for this batch";
    reader.decodeCustodyTx = async () => null;
    await assert.rejects(confirmReserve(user, "7", { txHash: TX }), {
      status: 404,
      message,
    });
    reader.decodeCustodyTx = async () => ({ ...mined(), success: false });
    await assert.rejects(confirmReserve(user, "7", { txHash: TX }), {
      status: 404,
    });
    reader.decodeCustodyTx = async () =>
      mined(event("BatchReserved", { transporter: TRANSPORTER }, "B2"));
    await assert.rejects(confirmReserve(user, "7", { txHash: TX }), {
      status: 404,
    });
    reader.decodeCustodyTx = async () =>
      mined(event("BatchClaimed", { transporter: TRANSPORTER }));
    await assert.rejects(confirmReserve(user, "7", { txHash: TX }), {
      status: 404,
    });
  });

  test("409 when another transporter sent the reserve", async () => {
    reader.decodeCustodyTx = async () =>
      mined(event("BatchReserved", { transporter: OTHER }));
    await assert.rejects(confirmReserve(user, "7", { txHash: TX }), {
      status: 409,
      message: "reserve event was not submitted by caller",
    });
  });

  test("409 when the chain no longer shows the caller's reservation", async () => {
    await assert.rejects(confirmReserve(user, "7", { txHash: TX }), {
      status: 409,
      message: "batch is not reserved by caller on chain",
    });
    reader.getBatch = async () => ({ ...reservedByCaller, reservedBy: OTHER });
    await assert.rejects(confirmReserve(user, "7", { txHash: TX }), {
      status: 409,
    });
    assert.deepEqual(calls, []);
  });

  test("marks the job reserved for the caller and returns the job view", async () => {
    reader.getBatch = async () => reservedByCaller;
    assert.deepEqual(await confirmReserve(user, "7", { txHash: TX }), {
      id: 7,
      status: "view",
    });
    const [[name, jobId, from, patch]] = calls;
    assert.equal(name, "transition");
    assert.equal(jobId, 7);
    assert.equal(from, "available");
    assert.ok(patch.reservedAt instanceof Date);
    assert.deepEqual(
      { ...patch, reservedAt: undefined },
      {
        status: "reserved",
        transporter: TRANSPORTER.toLowerCase(),
        reservedAt: undefined,
        reserveTxHash: TX.toLowerCase(),
      },
    );
  });

  test("409 when the job was taken meanwhile or the tx was already saved", async () => {
    reader.getBatch = async () => reservedByCaller;
    jobs.transition = async () => [];
    await assert.rejects(confirmReserve(user, "7", { txHash: TX }), {
      status: 409,
      message: "job is not available",
    });
    jobs.transition = async () => {
      throw Object.assign(new Error("duplicate"), { code: "23505" });
    };
    await assert.rejects(confirmReserve(user, "7", { txHash: TX }), {
      status: 409,
      message: "reservation already recorded off-chain",
    });
    jobs.findById = async () => ({ ...JOB, status: "reserved" });
    await assert.rejects(confirmReserve(user, "7", { txHash: TX }), {
      status: 409,
      message: "job is not available",
    });
  });
});

describe("confirmRelease", () => {
  const released = (releasedBy, transporter = TRANSPORTER) =>
    mined(event("ReservationReleased", { transporter, releasedBy }));

  beforeEach(() => {
    jobs.findById = async () => ({
      ...JOB,
      status: "reserved",
      transporter: TRANSPORTER.toLowerCase(),
    });
    reader.decodeCustodyTx = async () => released(TRANSPORTER);
  });

  test("409 for a job that is not reserved", async () => {
    jobs.findById = async () => JOB;
    await assert.rejects(confirmRelease(user, "7", { txHash: TX }), {
      status: 409,
      message: "job is not reserved",
    });
  });

  test("404 without a ReservationReleased event for this batch", async () => {
    reader.decodeCustodyTx = async () =>
      mined(event("ReservationReleased", { transporter: TRANSPORTER }, "B2"));
    await assert.rejects(confirmRelease(user, "7", { txHash: TX }), {
      status: 404,
      message:
        "tx not found or has no ReservationReleased event for this batch",
    });
  });

  test("403 when another wallet sent the release", async () => {
    reader.decodeCustodyTx = async () => released(OTHER);
    await assert.rejects(confirmRelease(user, "7", { txHash: TX }), {
      status: 403,
      message: "release event was not submitted by caller",
    });
    assert.deepEqual(calls, []);
  });

  test("puts the job back for the reserver, without needing a role", async () => {
    reader.hasRole = async () => false;
    assert.deepEqual(await confirmRelease(user, "7", { txHash: TX }), {
      id: 7,
      status: "view",
    });
    assert.deepEqual(calls, [
      ["releaseReservation", 7, TRANSPORTER.toLowerCase()],
    ]);
  });

  test("the listing facility releases the transporter named in the event", async () => {
    reader.decodeCustodyTx = async () => released(FARM, TRANSPORTER);
    await confirmRelease({ address: FARM }, "7", { txHash: TX });
    assert.deepEqual(calls, [
      ["releaseReservation", 7, TRANSPORTER.toLowerCase()],
    ]);
  });

  test("409 when the job is reserved for someone else", async () => {
    jobs.releaseReservation = async () => [];
    await assert.rejects(confirmRelease(user, "7", { txHash: TX }), {
      status: 409,
      message: "job is not reserved by that transporter",
    });
  });
});

describe("the claim needs the caller's reservation", () => {
  const body = { batchId: "B1", truck_details: "Truck 7" };

  test("409 when nobody reserved the batch, or another transporter did", async () => {
    await assert.rejects(prepareClaim(user, body), {
      status: 409,
      message: "batch not reserved for pickup",
    });
    reader.getBatch = async () => ({ ...reservedByCaller, reservedBy: OTHER });
    await assert.rejects(prepareClaim(user, body), {
      status: 409,
      message: "batch reserved by another transporter",
    });
    assert.deepEqual(calls, []);
  });

  test("409 without an open job row for the batch", async () => {
    reader.getBatch = async () => reservedByCaller;
    jobs.findClaimableForTransporter = async () => null;
    await assert.rejects(prepareClaim(user, body), {
      status: 409,
      message: "no open transporter job for this batch",
    });
  });

  test("prepares the claim for the reserver", async () => {
    reader.getBatch = async () => reservedByCaller;
    const result = await prepareClaim(user, body);
    assert.equal(result.batchId, "B1");
    assert.equal(result.productType, "olive");
    assert.deepEqual(calls, [
      ["findClaimableForTransporter", "B1", TRANSPORTER.toLowerCase()],
    ]);
    assert.deepEqual(encoded, [["claimBatch", "B1", result.dataHash]]);
  });

  test("the claim save moves the job from its current status to claimed", async () => {
    const claimed = () =>
      writeClaim({
        wallet: TRANSPORTER,
        batchId: "B1",
        txHash: TX,
        record: {},
        decoded: mined(
          event("BatchClaimed", {
            transporter: TRANSPORTER,
            intakeDataHash: "0x",
          }),
        ),
        dataHash: "0x",
        productType: "olive",
      });

    await claimed();
    assert.deepEqual(calls[0], [
      "findClaimableForTransporter",
      "B1",
      TRANSPORTER.toLowerCase(),
    ]);
    assert.deepEqual(calls[2], [
      "transition",
      7,
      "reserved",
      {
        transporter: TRANSPORTER.toLowerCase(),
        status: "claimed",
        claimTxHash: TX,
      },
      EXEC,
    ]);

    calls = [];
    jobs.findClaimableForTransporter = async () => ({
      id: 7,
      status: "available",
      transporter: null,
    });
    await claimed();
    assert.equal(calls[1][2], "available");

    jobs.findClaimableForTransporter = async () => null;
    await assert.rejects(claimed(), {
      status: 409,
      message: "no open transporter job for this batch",
    });
  });
});
