import { badRequest } from "../errors.js";

const MAX_BATCH_ID_LENGTH = 64;

// Validates a request body against a Zod schema and throws our standard
// `{ error: "invalid payload", details }` 400 error on failure.
export function parseOrThrow(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw badRequest("invalid payload", parsed.error.flatten());
  }
  return parsed.data;
}

export function parseBatchId(raw) {
  const batchId = typeof raw === "string" ? raw.trim() : "";
  if (!batchId || batchId.length > MAX_BATCH_ID_LENGTH) {
    throw badRequest("invalid batch id");
  }
  return batchId;
}

export function parseBatchIdFromBody(body) {
  const batchId = typeof body?.batchId === "string" ? body.batchId.trim() : "";
  if (!batchId || batchId.length > MAX_BATCH_ID_LENGTH) {
    throw badRequest("invalid batch id");
  }
  return batchId;
}
