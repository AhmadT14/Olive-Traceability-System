import { classifyBatchForParticipant } from "../chain/checks.js";
import { getBatch } from "../chain/reader.js";
import {
  AppError,
  forbidden,
  internalError,
  notFound,
  unprocessable,
} from "../errors.js";
import * as batchRepository from "../repositories/batch.repository.js";
import * as participantRepository from "../repositories/participant.repository.js";
import {
  profileDetailsSchemas,
  updateAvailabilitySchema,
  updateProfileSchema,
} from "../validation/participant.schemas.js";
import { parseBody } from "../validation/parse.js";
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
      // Role-specific details are checked against the participant's role.
      // Wallets that hold several roles are validated as their first one.
      const role = roles[0];
      if (!role) throw forbidden("wallet has no registered role");

      // Keys that are not sent keep their stored value.
      const merged = { ...(existing.details ?? {}), ...details };
      const result = profileDetailsSchemas[role].safeParse(merged);
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

// Reads the chain state of every batch the backend knows about, a few at a
// time, and sorts out the ones that concern the caller. The chain decides who
// holds what; the database only supplies the batch ids. A batch created on
// chain but never saved through the API is therefore not listed.
const CHAIN_READ_BATCH_SIZE = 25;

export async function listMyBatches(user) {
  try {
    const rows = await batchRepository.listIds();
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
