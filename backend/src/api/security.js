import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";

const REQUEST_ID = /^[\w-]{1,64}$/;

export function requestId(req, res, next) {
  const incoming = req.get("x-request-id");
  req.id = incoming && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.set("X-Request-Id", req.id);
  next();
}

export function authRateLimit({ limit = 20, windowMs = 60_000 } = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) =>
      res
        .status(429)
        .json({ error: "too many requests; try again in a minute" }),
  });
}
