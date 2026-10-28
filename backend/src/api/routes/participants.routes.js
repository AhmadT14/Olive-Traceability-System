import { Router } from "express";
import { getParticipantRoles } from "../../services/participant.service.js";
import { participantRolesResponseSchema } from "../../validation/response.schemas.js";
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

export default router;
