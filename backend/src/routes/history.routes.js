import { Router } from "express";
import { getBatchHistory } from "../chain/reader.js";

const router = Router();

router.get("/batches/:id/history", async (req, res) => {
  try {
    const batchId = req.params.id.trim();
    if (!batchId || batchId.length > 64) {
      return res.status(400).json({ error: "invalid batch id" });
    }

    const events = await getBatchHistory(batchId);
    if (events.length === 0) {
      return res.status(404).json({ error: "no events found for this batch" });
    }

    res.json({ batchId, events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "chain read failed" });
  }
});

export default router;
