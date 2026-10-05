import "dotenv/config";
import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address");

const schema = z.object({
  RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().int(),
  REGISTRY_ADDRESS: address,
  BATCH_CUSTODY_ADDRESS: address,
  DEPLOY_BLOCK: z.coerce.number().int().default(0),
  PORT: z.coerce.number().int().default(3000),
});

export const config = schema.parse(process.env);
