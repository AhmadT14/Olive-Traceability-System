import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import { recordImporterOutgoing } from "../../services/batch.service.js";
import { writeAckSchema } from "../../validation/response.schemas.js";
import { handle } from "../response.js";

const router = Router();

router.post(
  "/batches/:id/importer-outgoing",
  requireAuth,
  handle(
    async (req) => ({
      status: 201,
      body: await recordImporterOutgoing(req.user, req.params.id, req.body),
    }),
    writeAckSchema,
  ),
);

export default router;
