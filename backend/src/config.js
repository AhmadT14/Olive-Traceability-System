import "dotenv/config";
import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address");

const schema = z.object({
  DATABASE_URL: z.string().url(),
  RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().int(),
  REGISTRY_ADDRESS: address,
  BATCH_CUSTODY_ADDRESS: address,
  DEPLOY_BLOCK: z.coerce.number().int().default(0),
  LOG_BLOCK_RANGE: z.coerce.number().int().positive().default(10_000),
  PORT: z.coerce.number().int().default(3000),
  JWT_SECRET: z.string().min(32),
  AUTH_DOMAIN: z.string().min(1).default("localhost:5173"),
  AUTH_URI: z.string().url().default("http://localhost:5173"),
});

export const config = schema.parse(process.env);
