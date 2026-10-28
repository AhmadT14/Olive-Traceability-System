import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import {
  recordMillIntake,
  recordMillOutgoing,
} from "../../services/batch.service.js";
import { handle } from "../response.js";

const router = Router();

router.post(
  "/batches/:id/mill-intake",
  requireAuth,
  handle(async (req) => ({
    status: 201,
    body: await recordMillIntake(req.user, req.params.id, req.body),
  })),
);

router.post(
  "/batches/:id/mill-outgoing",
  requireAuth,
  handle(async (req) => ({
    status: 201,
    body: await recordMillOutgoing(req.user, req.params.id, req.body),
  })),
);

export default router;
