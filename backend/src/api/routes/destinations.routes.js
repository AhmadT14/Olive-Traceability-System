import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import {
  listBatchDestinations,
  listDestinationsForRole,
} from "../../services/destination.service.js";
import {
  batchDestinationsResponseSchema,
  destinationsResponseSchema,
} from "../../validation/response.schemas.js";
import { handle } from "../response.js";

const router = Router();

// Used on the farmer's create-batch form before a batch exists on chain.
router.get(
  "/destinations",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await listDestinationsForRole(req.query.role),
    }),
    destinationsResponseSchema,
  ),
);

router.get(
  "/batches/:id/destinations",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await listBatchDestinations(req.user, req.params.id),
    }),
    batchDestinationsResponseSchema,
  ),
);

export default router;
