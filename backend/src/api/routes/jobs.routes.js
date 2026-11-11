import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import { listJobs } from "../../services/jobs.service.js";
import {
  confirmRelease,
  confirmReserve,
  prepareRelease,
  prepareReserve,
} from "../../services/reservation.service.js";
import {
  jobResponseSchema,
  jobsResponseSchema,
  preparedReservationResponseSchema,
} from "../../validation/response.schemas.js";
import { handle } from "../response.js";

const router = Router();

router.get(
  "/transporter-jobs",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await listJobs(req.user, req.query),
    }),
    jobsResponseSchema,
  ),
);

router.post(
  "/transporter-jobs/:id/prepare-reserve",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await prepareReserve(req.user, req.params.id),
    }),
    preparedReservationResponseSchema,
  ),
);

router.post(
  "/transporter-jobs/:id/prepare-release",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await prepareRelease(req.user, req.params.id),
    }),
    preparedReservationResponseSchema,
  ),
);

router.post(
  "/transporter-jobs/:id/reserve",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await confirmReserve(req.user, req.params.id, req.body),
    }),
    jobResponseSchema,
  ),
);

router.delete(
  "/transporter-jobs/:id/reserve",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await confirmRelease(req.user, req.params.id, req.body),
    }),
    jobResponseSchema,
  ),
);

export default router;
