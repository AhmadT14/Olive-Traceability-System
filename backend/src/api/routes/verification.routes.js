import { Router } from "express";
import { verifyBatch } from "../../services/verification.service.js";
import { verificationResponseSchema } from "../../validation/response.schemas.js";
import { handle } from "../response.js";

const router = Router();

router.get(
  "/batches/:id/verify",
  handle(
    async (req) => ({
      status: 200,
      body: await verifyBatch(req.params.id),
    }),
    verificationResponseSchema,
  ),
);

export default router;
