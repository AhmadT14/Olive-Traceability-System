import { getBatch, hasRole, ROLES } from "../chain/reader.js";
import { isAvailable } from "../chain/checks.js";
import {
  AppError,
  conflict,
  forbidden,
  internalError,
  notFound,
} from "../errors.js";
import * as batchEventRepository from "../repositories/batchEvent.repository.js";
import * as participantRepository from "../repositories/participant.repository.js";
import * as transporterJobRepository from "../repositories/transporterJob.repository.js";
import {
  pageOf,
  parseJobId,
  parseJobStatusQuery,
  parseMineQuery,
  parsePageQuery,
} from "../validation/parse.js";

// Maps each outgoing record type to the camelCase shape the transporter job
// board exposes. Unknown types return null and are filtered out.
const shipmentDetails = (details) => ({
  quantityShipped: details.quantity_shipped ?? null,
  shipmentDetails: details.shipment_details ?? null,
  productCondition: details.product_condition ?? null,
  packagingCondition: details.packaging_condition ?? null,
  notes: details.notes ?? null,
});

const OUTGOING_DETAIL_MAPPERS = {
  farm: (details) => ({
    quantity: details.quantity ?? null,
    oliveType: details.olive_type ?? null,
    harvestDate: details.harvest_date ?? null,
  }),
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
  exporter_outgoing: shipmentDetails,
  importer_outgoing: shipmentDetails,
};

function findJobs(address, mine, status) {
  if (status === "completed") {
    return transporterJobRepository.listCompletedForTransporter(address);
  }
  return mine
    ? transporterJobRepository.listActiveForTransporter(address)
    : transporterJobRepository.listAvailable();
}

const isStillListed = (job, batch) =>
  batch.status === "Listed" &&
  batch.custodian.toLowerCase() === job.sourceParty.toLowerCase();

async function buildJobViews(jobs, { listedOnly }) {
  if (jobs.length === 0) return [];

  const addresses = [
    ...new Set(jobs.flatMap((job) => [job.sourceParty, job.destinationParty])),
  ];
  const listingTxHashes = jobs.map((job) => job.listingTxHash).filter(Boolean);

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

  return jobs.flatMap((job, index) => {
    const batch = chainBatches[index];
    // An open job is only claimable while the batch is still listed by the
    // party that posted it. The caller's own jobs follow the job row.
    if (listedOnly && !isStillListed(job, batch)) return [];

    const source = byAddress.get(job.sourceParty.toLowerCase());
    const destination = byAddress.get(job.destinationParty.toLowerCase());
    const sourceRoles = rolesByAddress.get(job.sourceParty.toLowerCase()) ?? [];
    const destinationRoles =
      rolesByAddress.get(job.destinationParty.toLowerCase()) ?? [];

    return [
      {
        id: job.id,
        status: job.status,
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
        reservedAt: job.reservedAt ?? null,
        createdAt: job.createdAt,
      },
    ];
  });
}

// The job board. By default it lists the open jobs any transporter may claim.
// With ?mine=true it lists the caller's own jobs that are still in progress
// (reserved, claimed, or handed over and waiting for the facility to confirm),
// so a transporter can find a job again. Adding status=completed lists the
// caller's finished jobs instead.
export async function listJobs(user, query) {
  const mine = parseMineQuery(query.mine);
  const status = parseJobStatusQuery(query.status, mine);
  const page = parsePageQuery(query);

  try {
    if (!(await hasRole("TRANSPORTER", user.address))) {
      throw forbidden("caller is not a transporter");
    }

    const found = await findJobs(user.address.toLowerCase(), mine, status);
    const jobs = mine ? pageOf(found, page) : found;
    const views = await buildJobViews(jobs, { listedOnly: !mine });
    return { jobs: mine ? views : pageOf(views, page) };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("job lookup failed", err);
  }
}

async function viewOf(id) {
  const [view] = await buildJobViews(
    [await transporterJobRepository.findById(id)],
    { listedOnly: false },
  );
  return view;
}

export async function reserveJob(user, rawId) {
  const id = parseJobId(rawId);
  const transporter = user.address.toLowerCase();

  try {
    if (!(await hasRole("TRANSPORTER", user.address))) {
      throw forbidden("caller is not a transporter");
    }

    const self = await participantRepository.findAvailability(transporter);
    if (self && !isAvailable(self.availability)) {
      throw conflict("transporter is marked unavailable");
    }

    const job = await transporterJobRepository.findById(id);
    if (!job) throw notFound("job not found");
    if (job.status !== "available") throw conflict("job is not available");

    const batch = await getBatch(job.batchId);
    if (!isStillListed(job, batch)) {
      throw conflict("batch is no longer listed for pickup");
    }

    const updated = await transporterJobRepository.transition(id, "available", {
      status: "reserved",
      transporter,
      reservedAt: new Date(),
    });
    if (updated.length === 0) throw conflict("job is not available");

    return await viewOf(id);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("job reservation failed", err);
  }
}

export async function releaseJob(user, rawId) {
  const id = parseJobId(rawId);
  const transporter = user.address.toLowerCase();

  try {
    const job = await transporterJobRepository.findById(id);
    if (!job) throw notFound("job not found");
    if (job.status !== "reserved") throw conflict("job is not reserved");
    if (job.transporter?.toLowerCase() !== transporter) {
      throw forbidden("job is reserved by another transporter");
    }

    const updated = await transporterJobRepository.releaseReservation(
      id,
      transporter,
    );
    if (updated.length === 0) throw conflict("job is not reserved");

    return await viewOf(id);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("job release failed", err);
  }
}
