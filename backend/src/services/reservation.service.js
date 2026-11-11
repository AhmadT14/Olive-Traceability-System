import { id } from "ethers";
import { sameAddress } from "../chain/addresses.js";
import {
  checkCanReleaseBatch,
  checkCanReserveBatch,
  isAvailable,
} from "../chain/checks.js";
import { batchCustody } from "../chain/contracts.js";
import { decodeCustodyTx, getBatch, hasRole } from "../chain/reader.js";
import { config } from "../config.js";
import {
  AppError,
  conflict,
  forbidden,
  internalError,
  isUniqueViolation,
  notFound,
} from "../errors.js";
import * as participantRepository from "../db/repositories/participant.repository.js";
import * as transporterJobRepository from "../db/repositories/transporterJob.repository.js";
import { reservationConfirmSchema } from "../validation/jobs.schemas.js";
import { parseBody, parseJobId } from "../validation/parse.js";
import { getJobView } from "./jobs.service.js";
import { prepareTransaction } from "./transaction.js";

function withErrors(message, work) {
  return work().catch((err) => {
    if (err instanceof AppError) throw err;
    if (isUniqueViolation(err)) {
      throw conflict("reservation already recorded off-chain");
    }
    throw internalError(message, err);
  });
}

async function requireTransporter(user) {
  if (!(await hasRole("TRANSPORTER", user.address))) {
    throw forbidden("caller is not a transporter");
  }
}

async function requireAvailable(user) {
  const self = await participantRepository.findAvailability(
    user.address.toLowerCase(),
  );
  if (self && !isAvailable(self.availability)) {
    throw conflict("transporter is marked unavailable");
  }
}

async function findJob(jobId, status) {
  const job = await transporterJobRepository.findById(jobId);
  if (!job) throw notFound("job not found");
  if (job.status !== status) throw conflict(`job is not ${status}`);
  return job;
}

function prepareCall(user, functionName, batchId) {
  const data = batchCustody.interface.encodeFunctionData(functionName, [
    batchId,
  ]);
  return prepareTransaction(user, config.BATCH_CUSTODY_ADDRESS, data);
}

async function findMinedEvent(txHash, name, batchId) {
  const decoded = await decodeCustodyTx(txHash);
  const event =
    decoded?.success &&
    decoded.events.find(
      (candidate) =>
        candidate.name === name && candidate.topics[1] === id(batchId),
    );
  if (!event) {
    throw notFound(`tx not found or has no ${name} event for this batch`);
  }
  return event;
}

export async function prepareReserve(user, rawId) {
  const jobId = parseJobId(rawId);

  return withErrors("job reservation failed", async () => {
    await requireTransporter(user);
    await requireAvailable(user);
    const job = await findJob(jobId, "available");

    const batch = await getBatch(job.batchId);
    const check = checkCanReserveBatch({ batch, role: "TRANSPORTER" });
    if (!check.allowed) throw conflict(check.reason);
    if (!sameAddress(batch.custodian, job.sourceParty)) {
      throw conflict("batch is no longer listed by this job's source");
    }

    const transaction = await prepareCall(user, "reserveBatch", job.batchId);
    return { id: jobId, batchId: job.batchId, transaction };
  });
}

export async function prepareRelease(user, rawId) {
  const jobId = parseJobId(rawId);

  return withErrors("job release failed", async () => {
    const job = await findJob(jobId, "reserved");

    const batch = await getBatch(job.batchId);
    const check = checkCanReleaseBatch({ batch, actor: user.address });
    if (!check.allowed) {
      throw batch.status === "Reserved"
        ? forbidden(check.reason)
        : conflict(check.reason);
    }

    const transaction = await prepareCall(user, "releaseBatch", job.batchId);
    return { id: jobId, batchId: job.batchId, transaction };
  });
}

export async function confirmReserve(user, rawId, body) {
  const jobId = parseJobId(rawId);
  const { txHash } = parseBody(reservationConfirmSchema, body);
  const wallet = user.address.toLowerCase();

  return withErrors("job reservation failed", async () => {
    await requireTransporter(user);
    const job = await findJob(jobId, "available");

    const event = await findMinedEvent(txHash, "BatchReserved", job.batchId);
    if (!sameAddress(event.args.transporter, wallet)) {
      throw conflict("reserve event was not submitted by caller");
    }

    const batch = await getBatch(job.batchId);
    if (batch.status !== "Reserved" || !sameAddress(batch.reservedBy, wallet)) {
      throw conflict("batch is not reserved by caller on chain");
    }

    const updated = await transporterJobRepository.transition(
      jobId,
      "available",
      {
        status: "reserved",
        transporter: wallet,
        reservedAt: new Date(),
        reserveTxHash: txHash,
      },
    );
    if (updated.length === 0) throw conflict("job is not available");

    return getJobView(jobId);
  });
}

export async function confirmRelease(user, rawId, body) {
  const jobId = parseJobId(rawId);
  const { txHash } = parseBody(reservationConfirmSchema, body);

  return withErrors("job release failed", async () => {
    const job = await findJob(jobId, "reserved");

    const event = await findMinedEvent(
      txHash,
      "ReservationReleased",
      job.batchId,
    );
    if (!sameAddress(event.args.releasedBy, user.address)) {
      throw forbidden("release event was not submitted by caller");
    }

    const updated = await transporterJobRepository.releaseReservation(
      jobId,
      String(event.args.transporter).toLowerCase(),
    );
    if (updated.length === 0) {
      throw conflict("job is not reserved by that transporter");
    }

    return getJobView(jobId);
  });
}
