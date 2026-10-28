import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import { listAvailableJobs } from "../../services/jobs.service.js";
import { handle } from "../response.js";

const router = Router();

router.get(
  "/transporter-jobs",
  requireAuth,
  handle(async (req) => ({
    status: 200,
    body: await listAvailableJobs(req.user),
  })),
);

export default router;
