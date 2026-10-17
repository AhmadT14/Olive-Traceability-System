import { Router } from "express";
import { and, ilike } from "drizzle-orm";
import { db } from "../db/db.js";
import { participants } from "../db/schema.js";
import { getBatch, hasRole } from "../chain/reader.js";
import { getNextStageRole } from "../chain/checks.js";
import { requireAuth } from "../auth/middleware.js";

const router = Router();

router.get("/batches/:id/destinations", requireAuth, async (req, res) => {
  const batchId = req.params.id.trim();
  if (!batchId || batchId.length > 64) {
    return res.status(400).json({ error: "invalid batch id" });
  }

  try {
    const batch = await getBatch(batchId);
    if (batch.status === "None") {
      return res.status(404).json({ error: "batch not found" });
    }
    if (batch.status !== "Listed") {
      return res.status(409).json({ error: "batch is not listed for pickup" });
    }
    if (batch.custodian.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: "caller is not current custodian" });
    }

    const role = getNextStageRole(batch.stage);
    if (!role) {
      return res.status(409).json({ error: "batch is already at final stage" });
    }

    const candidates = await db
      .select({ address: participants.walletAddress, name: participants.name })
      .from(participants)
      .where(
        and(
          ilike(participants.role, role),
          ilike(participants.status, "approved"),
          ilike(participants.availability, "available"),
        ),
      );

    const roleChecks = await Promise.all(
      candidates.map(({ address }) => hasRole(role, address)),
    );
    const destinations = candidates
      .filter((_, index) => roleChecks[index])
      .map(({ address, name }) => ({
        address,
        name,
        role,
      }));

    return res.json({ batchId, stage: batch.stage, role, destinations });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "destination lookup failed" });
  }
});

export default router;
