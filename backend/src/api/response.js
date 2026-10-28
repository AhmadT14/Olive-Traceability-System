import { internalError } from "../errors.js";
import { parseResponse } from "../validation/parse.js";
import { sendError } from "./errorHandler.js";

// Adapter for Express handlers. The callback returns `{ status, body }`;
// services throw AppError, which is mapped to the matching HTTP response.
//
// An optional response schema validates the outgoing body. A mismatch is a
// backend bug and becomes a logged 500 rather than an unexpected payload.
export function handle(fn, responseSchema) {
  return async (req, res) => {
    try {
      const result = await fn(req, res);
      if (res.headersSent) return;

      const { status = 200, body } = result ?? {};
      // Never emit an empty 200: a handler that forgets its body is a bug.
      if (body === undefined) {
        throw internalError(
          "internal server error",
          new Error(
            `handler for ${req.method} ${req.originalUrl} returned no body`,
          ),
        );
      }

      if (responseSchema) {
        parseResponse(responseSchema, body, `${req.method} ${req.originalUrl}`);
      }

      return res.status(status).json(body);
    } catch (err) {
      return sendError(res, err);
    }
  };
}
