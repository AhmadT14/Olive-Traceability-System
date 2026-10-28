import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import { recordReceipt } from "../../services/receipt.service.js";
import { handle } from "../response.js";

const router = Router();

router.post(
  "/batches/:id/receipt",
  requireAuth,
  handle(async (req) => ({
    status: 201,
    body: await recordReceipt(req.user, req.params.id, req.body),
  })),
);

export default router;
