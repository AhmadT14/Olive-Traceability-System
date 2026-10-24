import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { batchEvents } from "../db/schema.js";
import { getBatchHistory } from "../chain/reader.js";

const router = Router();

router.get("/batches/:id/history", async (req, res) => {
  try {
    const batchId = req.params.id.trim();
    if (!batchId || batchId.length > 64) {
      return res.status(400).json({ error: "invalid batch id" });
    }

    const [chainEvents, detailsRows] = await Promise.all([
      getBatchHistory(batchId),
      db
        .select({
          eventTxHash: batchEvents.eventTxHash,
          detailsType: batchEvents.detailsType,
          payloadVersion: batchEvents.payloadVersion,
          details: batchEvents.details,
          recordedAt: batchEvents.recordedAt,
        })
        .from(batchEvents)
        .where(eq(batchEvents.batchId, batchId))
        .orderBy(asc(batchEvents.recordedAt)),
    ]);
    if (chainEvents.length === 0) {
      return res.status(404).json({ error: "no events found for this batch" });
    }

    const detailsByTxHash = new Map(
      detailsRows.map((row) => [row.eventTxHash.toLowerCase(), row]),
    );
    const events = chainEvents.map((event) => {
      const details = detailsByTxHash.get(event.txHash.toLowerCase());
      return {
        ...event,
        details: details
          ? {
              type: details.detailsType,
              payloadVersion: details.payloadVersion,
              recordedAt: details.recordedAt,
              values: details.details,
            }
          : null,
      };
    });

    res.json({ batchId, events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "history lookup failed" });
  }
});

export default router;
