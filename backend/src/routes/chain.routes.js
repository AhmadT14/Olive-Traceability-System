import { Router } from "express";
import { getBatch } from "../chain/reader.js";

const router = Router();

router.get("/batches/:id/chain", async (req, res) => {
  try {
    const batchId = req.params.id.trim();
    if (!batchId || batchId.length > 64) {
      return res.status(400).json({ error: "invalid batch id" });
    }

    const batch = await getBatch(batchId);

    if (batch.status === "None") {
      return res.status(404).json({ error: "batch not found on chain" });
    }

    res.json({ batchId, ...batch });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "chain read failed" });
  }
});

export default router;
