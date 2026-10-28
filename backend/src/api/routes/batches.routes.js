import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import { recordFarmBatch } from "../../services/batch.service.js";
import { handle } from "../response.js";

const router = Router();

router.post(
  "/batches",
  requireAuth,
  handle(async (req) => ({
    status: 201,
    body: await recordFarmBatch(req.user, req.body),
  })),
);

export default router;
