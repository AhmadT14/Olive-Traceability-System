import { Router } from "express";
import { decodeTransaction } from "../../services/tx.service.js";
import { handle } from "../response.js";

const router = Router();

router.get(
  "/tx/:hash",
  handle(async (req) => ({
    status: 200,
    body: await decodeTransaction(req.params.hash),
  })),
);

export default router;
