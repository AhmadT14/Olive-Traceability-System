import { Router } from "express";
import {
  getParticipantRoles,
  getPublicProfile,
} from "../../services/participant.service.js";
import {
  participantRolesResponseSchema,
  publicProfileResponseSchema,
} from "../../validation/response.schemas.js";
import { handle } from "../response.js";

const router = Router();

router.get(
  "/participants/:address/roles",
  handle(
    async (req) => ({
      status: 200,
      body: await getParticipantRoles(req.params.address),
    }),
    participantRolesResponseSchema,
  ),
);

// Public: the consumer page shows who handled a batch without logging in.
router.get(
  "/participants/:address/profile",
  handle(
    async (req) => ({
      status: 200,
      body: await getPublicProfile(req.params.address),
    }),
    publicProfileResponseSchema,
  ),
);

export default router;
