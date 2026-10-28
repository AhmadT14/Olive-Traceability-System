import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import {
  claimBatch,
  handoverBatch,
} from "../../services/transporter.service.js";
import {
  claimAckSchema,
  handoverAckSchema,
} from "../../validation/response.schemas.js";
import { handle } from "../response.js";

const router = Router();

router.post(
  "/batches/:id/transporter-claim",
  requireAuth,
  handle(
    async (req) => ({
      status: 201,
      body: await claimBatch(req.user, req.params.id, req.body),
    }),
    claimAckSchema,
  ),
);

router.post(
  "/batches/:id/transporter-handover",
  requireAuth,
  handle(
    async (req) => ({
      status: 201,
      body: await handoverBatch(req.user, req.params.id, req.body),
    }),
    handoverAckSchema,
  ),
);

export default router;
