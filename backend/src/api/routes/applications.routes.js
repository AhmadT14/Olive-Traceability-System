import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import {
  getMyApplication,
  listApplications,
} from "../../services/applications.service.js";
import {
  applicationsResponseSchema,
  myApplicationResponseSchema,
} from "../../validation/response.schemas.js";
import { handle } from "../response.js";

const router = Router();

router.get(
  "/registration-applications/me",
  requireAuth,
  handle(
    async (req) => ({ status: 200, body: await getMyApplication(req.user) }),
    myApplicationResponseSchema,
  ),
);

router.get(
  "/admin/registration-applications",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await listApplications(req.user, req.query),
    }),
    applicationsResponseSchema,
  ),
);

export default router;
