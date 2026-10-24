import { z } from "zod";

export const batchIdSchema = z.string().trim().min(1).max(64);
export const txHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a tx hash");
export const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address");
export const quantitySchema = z.union([z.string(), z.number()]);

export const eventRecord = (fields) => z.object(fields);
