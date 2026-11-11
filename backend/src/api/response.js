import { internalError } from "../errors.js";
import { parseResponse } from "../validation/parse.js";
import { sendError } from "./errorHandler.js";

export function handle(fn, responseSchema) {
  return async (req, res) => {
    try {
      const result = await fn(req, res);
      if (res.headersSent) return;

      const { status = 200, body } = result ?? {};
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
