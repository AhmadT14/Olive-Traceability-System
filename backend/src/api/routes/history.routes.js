import { Router } from "express";
import { getBatchHistoryView } from "../../services/batchQuery.service.js";
import { historyResponseSchema } from "../../validation/response.schemas.js";
import { handle } from "../response.js";

const router = Router();

router.get(
  "/batches/:id/history",
  handle(
    async (req) => ({
      status: 200,
      body: await getBatchHistoryView(req.params.id),
    }),
    historyResponseSchema,
  ),
);

export default router;
