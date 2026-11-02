import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import { unauthorized } from "../../errors.js";
import {
  createLoginNonce,
  getSession,
  login,
  refreshSession,
} from "../../services/auth.service.js";
import {
  loginResponseSchema,
  nonceResponseSchema,
  sessionSchema,
} from "../../validation/response.schemas.js";
import { handle } from "../response.js";

const router = Router();

router.post(
  "/auth/login",
  handle(
    async (req) => ({
      status: 200,
      body: await login(req.body),
    }),
    loginResponseSchema,
  ),
);

router.post(
  "/auth/nonce",
  handle(
    async (req) => ({
      status: 200,
      body: createLoginNonce(req.body),
    }),
    nonceResponseSchema,
  ),
);

router.post(
  "/auth/refresh",
  requireAuth,
  handle(
    async (req) => ({ status: 200, body: await refreshSession(req.user) }),
    loginResponseSchema,
  ),
);

router.get(
  "/auth/me",
  requireAuth,
  handle(async (req) => {
    if (!req.user) throw unauthorized("missing token");
    return { status: 200, body: await getSession(req.user) };
  }, sessionSchema),
);

export default router;
