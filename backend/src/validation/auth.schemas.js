import { z } from "zod";
import { walletAddressSchema } from "./common.schemas.js";

export const nonceBodySchema = z.object({
  address: walletAddressSchema,
});

export const loginBodySchema = z.object({
  address: walletAddressSchema,
  signature: z.string(),
});
