import { getBatch, hasRole, ROLES } from "../chain/reader.js";
import { AppError, forbidden, internalError } from "../errors.js";
import * as batchEventRepository from "../repositories/batchEvent.repository.js";
import * as participantRepository from "../repositories/participant.repository.js";
import * as transporterJobRepository from "../repositories/transporterJob.repository.js";

// Maps each outgoing record type to the camelCase shape the transporter job
// board exposes. Unknown types return null and are filtered out.
const OUTGOING_DETAIL_MAPPERS = {
  storage_outgoing: (details) => ({
    quantityReleased: details.quantity_released ?? null,
    storageEndDate: details.storage_end_date ?? null,
    productCondition: details.product_condition ?? null,
    packagingCondition: details.packaging_condition ?? null,
    loadingDetails: details.loading_details ?? null,
    notes: details.notes ?? null,
  }),
  mill_outgoing: (details) => ({
    pressingDate: details.pressing_date ?? null,
    extractionMethod: details.extraction_method ?? null,
    outputQuantity: details.output_quantity ?? null,
    oilQuality: details.oil_quality ?? null,
    packagingDetails: details.packaging_details ?? null,
    qrCodeReference: details.qr_code_reference ?? null,
    notes: details.notes ?? null,
  }),
};

export async function listAvailableJobs(user) {
  try {
    if (!(await hasRole("TRANSPORTER", user.address))) {
      throw forbidden("caller is not a transporter");
    }

    const jobs = await transporterJobRepository.listAvailable();
    if (jobs.length === 0) return { jobs: [] };

    const addresses = [
      ...new Set(
        jobs.flatMap((job) => [job.sourceParty, job.destinationParty]),
      ),
    ];
    const listingTxHashes = jobs
      .map((job) => job.listingTxHash)
      .filter(Boolean);

    const [directory, chainBatches, outgoingRecords, chainRoles] =
      await Promise.all([
        participantRepository.listWithNamesByWallets(addresses),
        Promise.all(jobs.map((job) => getBatch(job.batchId))),
        batchEventRepository.findByTxHashes(listingTxHashes),
        Promise.all(
          addresses.map(async (address) => {
            const roleNames = Object.keys(ROLES);
            const statuses = await Promise.all(
              roleNames.map((role) => hasRole(role, address)),
            );
            return [
              address.toLowerCase(),
              roleNames.filter((_, index) => statuses[index]),
            ];
          }),
        ),
      ]);

    const byAddress = new Map(
      directory.map((participant) => [
        participant.walletAddress.toLowerCase(),
        participant,
      ]),
    );
    const outgoingByTxHash = new Map(
      outgoingRecords
        .map((event) => {
          const mapper = OUTGOING_DETAIL_MAPPERS[event.detailsType];
          return [event.eventTxHash, mapper ? mapper(event.details) : null];
        })
        .filter(([, details]) => details !== null),
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
      const sourceRoles =
        rolesByAddress.get(job.sourceParty.toLowerCase()) ?? [];
      const destinationRoles =
        rolesByAddress.get(job.destinationParty.toLowerCase()) ?? [];

      return [
        {
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
        },
      ];
    });

    return { jobs: availableJobs };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("job lookup failed", err);
  }
}
