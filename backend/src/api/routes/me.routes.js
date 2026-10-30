import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import {
  getMyProfile,
  listMyBatches,
  updateMyAvailability,
  updateMyProfile,
} from "../../services/me.service.js";
import {
  availabilityResponseSchema,
  myBatchesResponseSchema,
  myProfileResponseSchema,
} from "../../validation/response.schemas.js";
import { handle } from "../response.js";

const router = Router();

router.get(
  "/me/profile",
  requireAuth,
  handle(
    async (req) => ({ status: 200, body: await getMyProfile(req.user) }),
    myProfileResponseSchema,
  ),
);

router.patch(
  "/me/profile",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await updateMyProfile(req.user, req.body),
    }),
    myProfileResponseSchema,
  ),
);

router.patch(
  "/me/availability",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await updateMyAvailability(req.user, req.body),
    }),
    availabilityResponseSchema,
  ),
);

router.get(
  "/me/batches",
  requireAuth,
  handle(
    async (req) => ({ status: 200, body: await listMyBatches(req.user) }),
    myBatchesResponseSchema,
  ),
);

export default router;
