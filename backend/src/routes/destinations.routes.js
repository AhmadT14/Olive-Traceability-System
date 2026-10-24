import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import {
  participantProfiles,
  participants,
} from "../db/schema.js";
import { getBatch, hasRole } from "../chain/reader.js";
import { getNextStageRole } from "../chain/checks.js";
import { requireAuth } from "../auth/middleware.js";

const router = Router();

// Used on the farmer's create-batch form before a batch exists on chain.
router.get("/destinations", requireAuth, async (req, res) => {
  const role = typeof req.query.role === "string" ? req.query.role.toUpperCase() : "";
  if (role !== "MILL") {
    return res.status(400).json({ error: "role must be MILL" });
  }

  try {
    const candidates = await db
      .select({
        address: participants.walletAddress,
        name: participantProfiles.name,
      })
      .from(participants)
      .leftJoin(
        participantProfiles,
        eq(participantProfiles.walletAddress, participants.walletAddress),
      );

    const roleChecks = await Promise.all(
      candidates.map(({ address }) => hasRole(role, address)),
    );
    const destinations = candidates
      .filter((_, index) => roleChecks[index])
      .map(({ address, name }) => ({ address, name, role }));

    return res.json({ role, destinations });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "destination lookup failed" });
  }
});

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
    if (batch.status !== "Created") {
      return res.status(409).json({ error: "batch is not ready to be listed for pickup" });
    }
    if (batch.custodian.toLowerCase() !== req.user.address.toLowerCase()) {
      return res.status(403).json({ error: "caller is not current custodian" });
    }

    const role = getNextStageRole(batch.stage);
    if (!role) {
      return res.status(409).json({ error: "batch is already at final stage" });
    }

    const candidates = await db
      .select({
        address: participants.walletAddress,
        name: participantProfiles.name,
      })
      .from(participants)
      .leftJoin(
        participantProfiles,
        eq(participantProfiles.walletAddress, participants.walletAddress),
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
