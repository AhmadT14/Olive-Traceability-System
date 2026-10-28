import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import { recordStorageOutgoing } from "../../services/batch.service.js";
import { handle } from "../response.js";

const router = Router();

router.post(
  "/batches/:id/storage-outgoing",
  requireAuth,
  handle(async (req) => ({
    status: 201,
    body: await recordStorageOutgoing(req.user, req.params.id, req.body),
  })),
);

export default router;
