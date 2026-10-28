import { AppError } from "../errors.js";

export function sendError(res, err) {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    if (err.status >= 500) console.error(err.cause ?? err);
    const body = { error: err.message };
    if (err.details !== undefined) body.details = err.details;
    return res.status(err.status).json(body);
  }

  console.error(err);
  return res.status(500).json({ error: "internal server error" });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: "not found" });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "invalid JSON body" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "request body too large" });
  }
  if (err?.type === "encoding.unsupported") {
    return res.status(415).json({ error: "unsupported content encoding" });
  }

  return sendError(res, err);
}
