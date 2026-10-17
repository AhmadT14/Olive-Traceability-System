import { Router } from "express";
import { inArray, eq } from "drizzle-orm";
import { db } from "../db/db.js";
import {
  batchEvents,
  participantProfiles,
  participants,
  transporterJobs,
} from "../db/schema.js";
import { getBatch, hasRole, ROLES } from "../chain/reader.js";
import { requireAuth } from "../auth/middleware.js";

const router = Router();

router.get("/transporter-jobs", requireAuth, async (req, res) => {
  try {
    if (!(await hasRole("TRANSPORTER", req.user.address))) {
      return res.status(403).json({ error: "caller is not a transporter" });
    }

    const jobs = await db
      .select({
        id: transporterJobs.id,
        batchId: transporterJobs.batchId,
        sourceParty: transporterJobs.sourceParty,
        destinationParty: transporterJobs.destinationParty,
        listingTxHash: transporterJobs.listingTxHash,
        createdAt: transporterJobs.createdAt,
      })
      .from(transporterJobs)
      .where(eq(transporterJobs.status, "available"));

    if (jobs.length === 0) return res.json({ jobs: [] });

    const addresses = [
      ...new Set(jobs.flatMap((job) => [job.sourceParty, job.destinationParty])),
    ];
    const listingTxHashes = jobs
      .map((job) => job.listingTxHash)
      .filter(Boolean);
    const [directory, chainBatches, outgoingRecords, chainRoles] = await Promise.all([
      db
        .select({ walletAddress: participants.walletAddress, name: participantProfiles.name })
        .from(participants)
        .leftJoin(
          participantProfiles,
          eq(participantProfiles.walletAddress, participants.walletAddress),
        )
        .where(inArray(participants.walletAddress, addresses)),
      Promise.all(jobs.map((job) => getBatch(job.batchId))),
      listingTxHashes.length === 0
        ? Promise.resolve([])
        : db
            .select({
              eventTxHash: batchEvents.eventTxHash,
              detailsType: batchEvents.detailsType,
              details: batchEvents.details,
            })
            .from(batchEvents)
            .where(inArray(batchEvents.eventTxHash, listingTxHashes)),
      Promise.all(
        addresses.map(async (address) => {
          const roleNames = Object.keys(ROLES);
          const statuses = await Promise.all(
            roleNames.map((role) => hasRole(role, address)),
          );
          return [address.toLowerCase(), roleNames.filter((_, index) => statuses[index])];
        }),
      ),
    ]);
    const byAddress = new Map(
      directory.map((participant) => [participant.walletAddress.toLowerCase(), participant]),
    );
    const outgoingByTxHash = new Map(
      outgoingRecords
        .filter((event) => event.detailsType === "mill_outgoing")
        .map((event) => [event.eventTxHash, {
          pressingDate: event.details.pressing_date ?? null,
          extractionMethod: event.details.extraction_method ?? null,
          outputQuantity: event.details.output_quantity ?? null,
          oilQuality: event.details.oil_quality ?? null,
          packagingDetails: event.details.packaging_details ?? null,
          qrCodeReference: event.details.qr_code_reference ?? null,
          notes: event.details.notes ?? null,
        }]),
    );
    const rolesByAddress = new Map(chainRoles);

    const availableJobs = jobs.flatMap((job, index) => {
      const batch = chainBatches[index];
      if (
        batch.status !== "Listed" ||
        batch.custodian.toLowerCase() !== job.sourceParty.toLowerCase()
      ) {
        return [];
      }

      const source = byAddress.get(job.sourceParty.toLowerCase());
      const destination = byAddress.get(job.destinationParty.toLowerCase());
      const sourceRoles = rolesByAddress.get(job.sourceParty.toLowerCase()) ?? [];
      const destinationRoles = rolesByAddress.get(job.destinationParty.toLowerCase()) ?? [];
      return [{
        id: job.id,
        batchId: job.batchId,
        stage: batch.stage,
        source: {
          name: source?.name ?? null,
          role: sourceRoles[0] ?? null,
          roles: sourceRoles,
        },
        destination: {
          name: destination?.name ?? null,
          role: destinationRoles[0] ?? null,
          roles: destinationRoles,
          address: job.destinationParty,
        },
        outgoingDetails: outgoingByTxHash.get(job.listingTxHash) ?? null,
        createdAt: job.createdAt,
      }];
    });

    return res.json({ jobs: availableJobs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "job lookup failed" });
  }
});

export default router;
