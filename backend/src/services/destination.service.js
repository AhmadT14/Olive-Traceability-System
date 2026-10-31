import { getBatch, hasRole } from "../chain/reader.js";
import { getNextStageRole, isAvailable } from "../chain/checks.js";
import {
  AppError,
  conflict,
  forbidden,
  internalError,
  notFound,
} from "../errors.js";
import * as participantRepository from "../repositories/participant.repository.js";
import { parseBatchId, parseDestinationRole } from "../validation/parse.js";

// Both lists leave out participants who have set themselves to "unavailable".
// Used on the farmer's create-batch form before a batch exists on chain.
export async function listDestinationsForRole(rawRole) {
  const role = parseDestinationRole(rawRole);

  try {
    const candidates = await participantRepository.listWithNames();
    const roleChecks = await Promise.all(
      candidates.map(({ address }) => hasRole(role, address)),
    );
    const destinations = candidates
      .filter((c, index) => roleChecks[index] && isAvailable(c.availability))
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
      .filter((c, index) => roleChecks[index] && isAvailable(c.availability))
      .map(({ address, name }) => ({ address, name, role }));

    return { batchId, stage: batch.stage, role, destinations };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("destination lookup failed", err);
  }
}
