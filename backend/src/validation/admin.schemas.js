import { z } from "zod";
import { profileSchema } from "./participant.schemas.js";
import { txHashSchema, walletAddressSchema } from "./common.schemas.js";
import { RoleNames } from "../chain/enums.js";

export const roleNames = RoleNames;

export const prepareRoleChangeSchema = z.object({
  address: walletAddressSchema,
  role: z.enum(roleNames),
  action: z.enum(["register", "revoke"]),
});

const roleChangeIdentity = {
  address: walletAddressSchema,
  role: z.enum(roleNames),
  txHash: txHashSchema,
};

export const confirmRoleChangeSchema = z.discriminatedUnion("action", [
  z.object({
    ...roleChangeIdentity,
    action: z.literal("register"),
    profile: profileSchema,
  }),
  z.object({
    ...roleChangeIdentity,
    action: z.literal("revoke"),
  }),
]);
