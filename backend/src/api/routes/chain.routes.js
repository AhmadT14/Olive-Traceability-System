import { Router } from "express";
import { getChainBatch } from "../../services/batchQuery.service.js";
import { handle } from "../response.js";

const router = Router();

router.get(
  "/batches/:id/chain",
  handle(async (req) => ({
    status: 200,
    body: await getChainBatch(req.params.id),
  })),
);

export default router;
