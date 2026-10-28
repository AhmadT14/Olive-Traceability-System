import { getBatch, hasRole } from "../chain/reader.js";
import { getNextStageRole } from "../chain/checks.js";
import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  internalError,
  notFound,
} from "../errors.js";
import * as participantRepository from "../repositories/participant.repository.js";
import { parseBatchId } from "../validation/parse.js";

// Used on the farmer's create-batch form before a batch exists on chain.
export async function listDestinationsForRole(rawRole) {
  const role = typeof rawRole === "string" ? rawRole.toUpperCase() : "";
  if (role !== "MILL") throw badRequest("role must be MILL");

  try {
    const candidates = await participantRepository.listWithNames();
    const roleChecks = await Promise.all(
      candidates.map(({ address }) => hasRole(role, address)),
    );
    const destinations = candidates
      .filter((_, index) => roleChecks[index])
      .map(({ address, name }) => ({ address, name, role }));

    return { role, destinations };
  } catch (err) {
    throw internalError("destination lookup failed", err);
  }
}

export async function listBatchDestinations(user, rawBatchId) {
  const batchId = parseBatchId(rawBatchId);

  try {
    const batch = await getBatch(batchId);
    if (batch.status === "None") throw notFound("batch not found");
    if (batch.status !== "Created") {
      throw conflict("batch is not ready to be listed for pickup");
    }
    if (batch.custodian.toLowerCase() !== user.address.toLowerCase()) {
      throw forbidden("caller is not current custodian");
    }

    const role = getNextStageRole(batch.stage);
    if (!role) throw conflict("batch is already at final stage");

    const candidates = await participantRepository.listWithNames();
    const roleChecks = await Promise.all(
      candidates.map(({ address }) => hasRole(role, address)),
    );
    const destinations = candidates
      .filter((_, index) => roleChecks[index])
      .map(({ address, name }) => ({ address, name, role }));

    return { batchId, stage: batch.stage, role, destinations };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("destination lookup failed", err);
  }
}
