import { id } from "ethers";
import { classifyBatchForParticipant } from "../chain/checks.js";
import { matchCreatedBatches } from "../chain/createdBatches.js";
import { syncEvents } from "../chain/eventIndex.js";
import { getBatch, getBatchCreatedEvents, hasRole } from "../chain/reader.js";
import {
  AppError,
  forbidden,
  internalError,
  notFound,
  unprocessable,
} from "../errors.js";
import * as batchEventRepository from "../db/repositories/batchEvent.repository.js";
import * as chainEventRepository from "../db/repositories/chainEvent.repository.js";
import * as batchRepository from "../db/repositories/batch.repository.js";
import * as participantRepository from "../db/repositories/participant.repository.js";
import * as pendingSaveRepository from "../db/repositories/pendingSave.repository.js";
import * as transporterJobRepository from "../db/repositories/transporterJob.repository.js";
import {
  profileDetailsSchemaForRoles,
  updateAvailabilitySchema,
  updateProfileSchema,
} from "../validation/participant.schemas.js";
import { pageOf, parseBody, parsePageQuery } from "../validation/parse.js";
import { readRoles } from "./participant.service.js";

// The database keeps wallets in lower case.
const walletOf = (user) => user.address.toLowerCase();

function toProfileView(user, roles, row) {
  return {
    address: walletOf(user),
    roles,
    profile: {
      name: row.name ?? null,
      contactPhone: row.contactPhone ?? null,
      email: row.email ?? null,
      address: row.address ?? null,
      location: row.location ?? null,
      availability: row.availability ?? null,
      details: row.details ?? {},
    },
  };
}

async function requireProfile(user) {
  const row = await participantRepository.findProfile(walletOf(user));
  if (!row) {
    throw notFound("no profile on file for this wallet; ask the admin");
  }
  return row;
}

export async function getMyProfile(user) {
  try {
    const [row, roles] = await Promise.all([
      requireProfile(user),
      readRoles(user.address),
    ]);
    return toProfileView(user, roles, row);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("profile lookup failed", err);
  }
}

export async function updateMyProfile(user, body) {
  const patch = parseBody(updateProfileSchema, body);

  try {
    const [existing, roles] = await Promise.all([
      requireProfile(user),
      readRoles(user.address),
    ]);

    const { details, ...fields } = patch;
    const updates = { ...fields };

    if (details !== undefined) {
      // Role-specific details are checked against every role the participant
      // holds, so a wallet with several roles keeps the keys of each one.
      if (roles.length === 0) throw forbidden("wallet has no registered role");

      // Keys that are not sent keep their stored value.
      const merged = { ...(existing.details ?? {}), ...details };
      const result = profileDetailsSchemaForRoles(roles).safeParse(merged);
      if (!result.success) {
        throw unprocessable("invalid profile details", result.error.flatten());
      }
      updates.details = result.data;
    }

    const row = await participantRepository.updateProfile(
      walletOf(user),
      updates,
    );
    return toProfileView(user, roles, row);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("profile update failed", err);
  }
}

export async function updateMyAvailability(user, body) {
  const { availability } = parseBody(updateAvailabilitySchema, body);

  try {
    await requireProfile(user);
    await participantRepository.updateProfile(walletOf(user), { availability });
    return { address: walletOf(user), availability };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("availability update failed", err);
  }
}

// The event index narrows the batches to the ones whose events name the
// caller (every change of custodian or pending target does), then their chain
// state decides who holds what. A batch created on chain but never saved
// through the API is not listed.
const CHAIN_READ_BATCH_SIZE = 25;

export async function listMyBatches(user) {
  try {
    await syncEvents();
    const [topicRows, idRows] = await Promise.all([
      chainEventRepository.listBatchTopicsByAddress(walletOf(user)),
      batchRepository.listIds(),
    ]);
    const topics = new Set(
      topicRows.map(({ batchTopic }) => batchTopic.toLowerCase()),
    );
    const rows = idRows.filter(({ batchId }) =>
      topics.has(id(batchId).toLowerCase()),
    );
    const result = { holding: [], listedByMe: [], awaitingMyConfirmation: [] };

    for (let i = 0; i < rows.length; i += CHAIN_READ_BATCH_SIZE) {
      const chunk = rows.slice(i, i + CHAIN_READ_BATCH_SIZE);
      const states = await Promise.all(
        chunk.map(({ batchId }) => getBatch(batchId)),
      );
      states.forEach((state, index) => {
        const bucket = classifyBatchForParticipant(state, user.address);
        if (bucket)
          result[bucket].push({ batchId: chunk[index].batchId, ...state });
      });
    }

    return result;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("batch lookup failed", err);
  }
}

// Every batch the caller created as a farmer, newest first, with its current
// chain state, so a batch stays in the list after a transporter has taken it.
// Created batches come from the chain's BatchCreated events for the caller;
// the readable batch id and the farm fields come from the saved farm record.
export async function listCreatedBatches(user, query) {
  const page = parsePageQuery(query);

  try {
    if (!(await hasRole("FARMER", user.address))) {
      throw forbidden("caller is not a farmer");
    }

    const events = await getBatchCreatedEvents(user.address);
    const rows = await batchEventRepository.findFarmEventsByTxHashes(
      events.map((event) => event.txHash),
    );
    const created = pageOf(matchCreatedBatches(events, rows), page);
    const detailsByBatch = new Map(
      rows.map((row) => [row.batchId, row.details]),
    );

    const batches = [];
    for (let i = 0; i < created.length; i += CHAIN_READ_BATCH_SIZE) {
      const chunk = created.slice(i, i + CHAIN_READ_BATCH_SIZE);
      const states = await Promise.all(
        chunk.map(({ batchId }) => getBatch(batchId)),
      );
      chunk.forEach((item, index) => {
        const details = detailsByBatch.get(item.batchId);
        batches.push({
          ...states[index],
          ...item,
          quantity: details?.quantity ?? null,
          olive_type: details?.olive_type ?? null,
        });
      });
    }

    return { batches };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("created batch lookup failed", err);
  }
}

export async function listReceivedBatches(user, query) {
  const page = parsePageQuery(query);

  try {
    const rows = await transporterJobRepository.listReceivedByParty(
      walletOf(user),
      page,
    );

    return {
      batches: rows.map((row) => ({
        batchId: row.batchId,
        txHash: row.txHash,
        receivedAt: new Date(row.receivedAt).toISOString(),
        quantityReceived: row.details?.quantity_received ?? null,
      })),
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("received batch lookup failed", err);
  }
}

export async function listMyPendingSaves(user, query) {
  const page = parsePageQuery(query);

  try {
    const rows = await pendingSaveRepository.listForWallet(
      walletOf(user),
      page,
    );
    return {
      saves: rows.map((row) => ({
        id: row.id,
        batchId: row.batchId,
        detailsType: row.detailsType,
        status: row.status,
        txHash: row.txHash ?? null,
        failureReason: row.failureReason ?? null,
        payload: row.payload,
        createdAt: row.createdAt,
        resolvedAt: row.resolvedAt ?? null,
      })),
    };
  } catch (err) {
    throw internalError("pending save lookup failed", err);
  }
}
