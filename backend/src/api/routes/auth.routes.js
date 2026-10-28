import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import { unauthorized } from "../../errors.js";
import { createLoginNonce, login } from "../../services/auth.service.js";
import { handle } from "../response.js";

const router = Router();

router.post(
  "/auth/login",
  handle(async (req) => ({
    status: 200,
    body: await login(req.body),
  })),
);

router.post(
  "/auth/nonce",
  handle(async (req) => ({
    status: 200,
    body: createLoginNonce(req.body),
  })),
);

router.get(
  "/auth/me",
  requireAuth,
  handle(async (req) => {
    if (!req.user) throw unauthorized("missing token");
    return { status: 200, body: req.user };
  }),
);

export default router;
