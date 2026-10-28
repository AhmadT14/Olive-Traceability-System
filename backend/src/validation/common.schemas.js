import { isAddress } from "ethers";
import { z } from "zod";

export const batchIdSchema = z.string().trim().min(1).max(64);
export const txHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "must be a tx hash");
export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address");
// ethers' isAddress is stricter than the regex above (checks the EIP-55
// checksum for mixed-case input), which is what auth and the participant
// lookup used before this schema layer existed.
export const walletAddressSchema = z
  .string()
  .refine(isAddress, "must be a valid wallet address");
export const quantitySchema = z.union([z.string(), z.number()]);

export const eventRecord = (fields) => z.object(fields);
