import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import {
  claimBatch,
  handoverBatch,
} from "../../services/transporter.service.js";
import { handle } from "../response.js";

const router = Router();

router.post(
  "/batches/:id/transporter-claim",
  requireAuth,
  handle(async (req) => ({
    status: 201,
    body: await claimBatch(req.user, req.params.id, req.body),
  })),
);

router.post(
  "/batches/:id/transporter-handover",
  requireAuth,
  handle(async (req) => ({
    status: 201,
    body: await handoverBatch(req.user, req.params.id, req.body),
  })),
);

export default router;
