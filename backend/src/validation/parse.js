import { badRequest, internalError, unprocessable } from "../errors.js";
import {
  batchIdParamSchema,
  destinationRoleQuerySchema,
  jobStatusQuerySchema,
  limitQuerySchema,
  mineQuerySchema,
  offsetQuerySchema,
  txHashParamSchema,
  walletAddressParamSchema,
} from "./request.schemas.js";

// -- bodies ---------------------------------------------------------------
//
// A request body that is missing entirely (or is not a JSON object) is a
// malformed request -> 400. A body that is present but fails its schema is
// syntactically fine and semantically invalid -> 422.
export function parseBody(schema, payload) {
  if (
    payload === undefined ||
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw badRequest("invalid payload");
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw unprocessable("invalid payload", parsed.error.flatten());
  }
  return parsed.data;
}

// -- path parameters and query strings ------------------------------------
//
// These keep the endpoint-specific messages and 400 status that the original
// hand-written checks returned.
export function parseBatchId(raw) {
  const parsed = batchIdParamSchema.safeParse(raw);
  if (!parsed.success) throw badRequest("invalid batch id");
  return parsed.data;
}

export function parseBatchIdFromBody(body) {
  const parsed = batchIdParamSchema.safeParse(body?.batchId);
  if (!parsed.success) throw badRequest("invalid batch id");
  return parsed.data;
}

export function parseTxHash(raw) {
  const parsed = txHashParamSchema.safeParse(raw);
  if (!parsed.success) throw badRequest("invalid tx hash");
  return parsed.data;
}

export function parseWalletAddress(raw) {
  const parsed = walletAddressParamSchema.safeParse(raw);
  if (!parsed.success) throw badRequest("invalid address");
  return parsed.data;
}

export function parseDestinationRole(raw) {
  const parsed = destinationRoleQuerySchema.safeParse(raw);
  if (!parsed.success) throw badRequest("role must be MILL");
  return parsed.data;
}

export function parseMineQuery(raw) {
  const parsed = mineQuerySchema.safeParse(raw);
  if (!parsed.success) throw badRequest("mine must be true or false");
  return parsed.data === "true";
}

export function parseJobStatusQuery(raw, mine) {
  const parsed = jobStatusQuerySchema.safeParse(raw);
  if (!parsed.success) throw badRequest("status must be completed");
  if (parsed.data && !mine) throw badRequest("status requires mine=true");
  return parsed.data;
}

export function parsePageQuery(query) {
  const limit = limitQuerySchema.safeParse(query?.limit);
  if (!limit.success) {
    throw badRequest("limit must be an integer from 1 to 100");
  }
  const offset = offsetQuerySchema.safeParse(query?.offset);
  if (!offset.success) {
    throw badRequest("offset must be a non-negative integer");
  }
  return { limit: limit.data, offset: offset.data ?? 0 };
}

export function pageOf(items, { limit, offset }) {
  return items.slice(offset, limit === undefined ? undefined : offset + limit);
}

// -- responses ------------------------------------------------------------
//
// Responses are ours, so a schema mismatch means a bug. Fail with a logged
// 500 instead of sending a shape the frontend does not expect. The original
// payload is returned unchanged (Zod's parsed copy may strip unknown keys).
export function parseResponse(schema, payload, label = "response") {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw internalError(
      "internal server error",
      new Error(
        `${label} does not match its schema: ${JSON.stringify(
          parsed.error.flatten(),
        )}`,
      ),
    );
  }
  return payload;
}
