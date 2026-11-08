import { batchExists } from "../chain/enums.js";
import { getBatch, hasAdminRole } from "../chain/reader.js";
import { countByStage } from "../chain/stageCounts.js";
import { AppError, forbidden, internalError } from "../errors.js";
import * as batchRepository from "../repositories/batch.repository.js";

const CHAIN_READ_BATCH_SIZE = 25;

export async function countBatchesPerStage(user) {
  try {
    if (!(await hasAdminRole(user.address))) {
      throw forbidden("caller is not a registry admin");
    }

    const rows = await batchRepository.listIds();
    const stages = [];
    for (let i = 0; i < rows.length; i += CHAIN_READ_BATCH_SIZE) {
      const chunk = rows.slice(i, i + CHAIN_READ_BATCH_SIZE);
      const batches = await Promise.all(
        chunk.map(({ batchId }) => getBatch(batchId)),
      );
      for (const batch of batches) {
        if (batchExists(batch)) stages.push(batch.stage);
      }
    }
    return { stages: countByStage(stages) };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("batch statistics lookup failed", err);
  }
}
