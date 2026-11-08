import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import {
  confirmRoleChange,
  listParticipants,
  prepareRoleChange,
} from "../../services/admin.service.js";
import { countBatchesPerStage } from "../../services/stats.service.js";
import {
  adminParticipantsResponseSchema,
  batchStageStatsResponseSchema,
  roleChangeConfirmedResponseSchema,
  roleChangePreparedResponseSchema,
} from "../../validation/response.schemas.js";
import { handle } from "../response.js";

const router = Router();

router.get(
  "/admin/participants",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await listParticipants(req.user, req.query),
    }),
    adminParticipantsResponseSchema,
  ),
);

router.get(
  "/admin/stats/batches",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await countBatchesPerStage(req.user),
    }),
    batchStageStatsResponseSchema,
  ),
);

router.post(
  "/admin/participants/prepare-role-change",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await prepareRoleChange(req.user, req.body),
    }),
    roleChangePreparedResponseSchema,
  ),
);

router.post(
  "/admin/participants/confirm-role-change",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await confirmRoleChange(req.user, req.body),
    }),
    roleChangeConfirmedResponseSchema,
  ),
);

export default router;
