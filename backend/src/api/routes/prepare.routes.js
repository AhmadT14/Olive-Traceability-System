import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import {
  prepareBatch,
  prepareClaim,
  prepareExporterListing,
  prepareHandover,
  prepareImporterListing,
  prepareListing,
  prepareReceipt,
  prepareStorageListing,
} from "../../services/prepare.service.js";
import { handle } from "../response.js";

const router = Router();

router.post(
  "/batches/prepare",
  requireAuth,
  handle(async (req) => ({
    status: 200,
    body: await prepareBatch(req.user, req.body),
  })),
);

router.post(
  "/batches/prepare-listing",
  requireAuth,
  handle(async (req) => ({
    status: 200,
    body: await prepareListing(req.user, req.body),
  })),
);

router.post(
  "/batches/prepare-storage-listing",
  requireAuth,
  handle(async (req) => ({
    status: 200,
    body: await prepareStorageListing(req.user, req.body),
  })),
);

router.post(
  "/batches/prepare-exporter-listing",
  requireAuth,
  handle(async (req) => ({
    status: 200,
    body: await prepareExporterListing(req.user, req.body),
  })),
);

router.post(
  "/batches/prepare-importer-listing",
  requireAuth,
  handle(async (req) => ({
    status: 200,
    body: await prepareImporterListing(req.user, req.body),
  })),
);

router.post(
  "/batches/prepare-claim",
  requireAuth,
  handle(async (req) => ({
    status: 200,
    body: await prepareClaim(req.user, req.body),
  })),
);

router.post(
  "/batches/prepare-handover",
  requireAuth,
  handle(async (req) => ({
    status: 200,
    body: await prepareHandover(req.user, req.body),
  })),
);

router.post(
  "/batches/prepare-receipt",
  requireAuth,
  handle(async (req) => ({
    status: 200,
    body: await prepareReceipt(req.user, req.body),
  })),
);

export default router;
