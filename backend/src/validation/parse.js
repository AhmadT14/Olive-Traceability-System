import { badRequest, internalError, unprocessable } from "../errors.js";
import {
  batchIdParamSchema,
  destinationRoleQuerySchema,
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
