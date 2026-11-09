import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import {
  approveApplication,
  prepareApproval,
  rejectApplication,
  submitApplication,
} from "../../services/signup.service.js";
import {
  myApplicationResponseSchema,
  roleChangePreparedResponseSchema,
} from "../../validation/response.schemas.js";
import { handle } from "../response.js";

const router = Router();

router.post(
  "/registration-applications",
  requireAuth,
  handle(
    async (req) => ({
      status: 201,
      body: await submitApplication(req.user, req.body),
    }),
    myApplicationResponseSchema,
  ),
);

router.post(
  "/admin/registration-applications/:id/prepare-approval",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await prepareApproval(req.user, req.params.id),
    }),
    roleChangePreparedResponseSchema,
  ),
);

router.post(
  "/admin/registration-applications/:id/approve",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await approveApplication(req.user, req.params.id, req.body),
    }),
    myApplicationResponseSchema,
  ),
);

router.post(
  "/admin/registration-applications/:id/reject",
  requireAuth,
  handle(
    async (req) => ({
      status: 200,
      body: await rejectApplication(req.user, req.params.id, req.body),
    }),
    myApplicationResponseSchema,
  ),
);

export default router;
