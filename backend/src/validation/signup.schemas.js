import { z } from "zod";
import { RoleNames } from "../chain/enums.js";
import { txHashSchema } from "./common.schemas.js";
import { profileSchema } from "./participant.schemas.js";

export const submitApplicationSchema = z.object({
  role: z.enum(RoleNames),
  profile: profileSchema,
});

export const approveApplicationSchema = z.object({
  txHash: txHashSchema,
});

export const rejectApplicationSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
