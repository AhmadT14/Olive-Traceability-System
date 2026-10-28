import { Router } from "express";
import { requireAuth } from "../../auth/middleware.js";
import {
  confirmRoleChange,
  prepareRoleChange,
} from "../../services/admin.service.js";
import { handle } from "../response.js";

const router = Router();

router.post(
  "/admin/participants/prepare-role-change",
  requireAuth,
  handle(async (req) => ({
    status: 200,
    body: await prepareRoleChange(req.user, req.body),
  })),
);

router.post(
  "/admin/participants/confirm-role-change",
  requireAuth,
  handle(async (req) => ({
    status: 200,
    body: await confirmRoleChange(req.user, req.body),
  })),
);

export default router;
