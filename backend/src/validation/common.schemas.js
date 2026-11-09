import { isAddress } from "ethers";
import { z } from "zod";

export const batchIdSchema = z.string().trim().min(1).max(64);
export const txHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "must be a tx hash")
  .toLowerCase();
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

const isCalendarDate = (value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be a date as YYYY-MM-DD")
  .refine(isCalendarDate, "must be a real calendar date");
