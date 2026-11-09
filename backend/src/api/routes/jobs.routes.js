import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import {
  listJobs,
  releaseJob,
  reserveJob,
} from "../../services/jobs.service.js";
import {
  jobResponseSchema,
  jobsResponseSchema,
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
  "/transporter-jobs/:id/reserve",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await reserveJob(req.user, req.params.id),
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
      body: await releaseJob(req.user, req.params.id),
    }),
    jobResponseSchema,
  ),
);

export default router;
