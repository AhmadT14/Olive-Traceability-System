import { isAddress } from "ethers";
import { z } from "zod";
import { profileSchema } from "./participant.schemas.js";
import { txHashSchema } from "./common.schemas.js";

export const roleNames = [
  "FARMER",
  "MILL",
  "TRANSPORTER",
  "STORAGE",
  "EXPORTER",
  "IMPORTER",
  "RETAILER",
];

const walletAddressSchema = z.string().refine(isAddress, "must be a valid wallet address");

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
