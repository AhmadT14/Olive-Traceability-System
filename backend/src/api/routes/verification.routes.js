import { Router } from "express";
import { verifyBatch } from "../../services/verification.service.js";
import { handle } from "../response.js";

const router = Router();

router.get(
  "/batches/:id/verify",
  handle(async (req) => ({
    status: 200,
    body: await verifyBatch(req.params.id),
  })),
);

export default router;
