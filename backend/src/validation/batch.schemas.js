import { z } from "zod";
import { addressSchema, batchIdSchema, quantitySchema, txHashSchema } from "./common.schemas.js";

export const createBatchSchema = z.object({
  txHash: txHashSchema,
  batchId: batchIdSchema,
  harvest_date: z.string(),
  location: z.string().max(255),
  olive_type: z.string().max(128),
  quantity: quantitySchema.optional(),
  cultivation_method: z.string().optional(),
  irrigation_method: z.string().optional(),
  fertilizer_details: z.string().optional(),
  pesticide_details: z.string().optional(),
  harvesting_method: z.string().optional(),
  quality_details: z.string().optional(),
  farm_notes: z.string().optional(),
});

export const farmPreparationSchema = z.object({
  batchId: batchIdSchema,
  destinationAddress: addressSchema,
  harvest_date: z.string().min(1),
  location: z.string().max(255),
  olive_type: z.string().max(128),
  quantity: quantitySchema.optional(),
  cultivation_method: z.string().optional(),
  irrigation_method: z.string().optional(),
  fertilizer_details: z.string().optional(),
  pesticide_details: z.string().optional(),
  harvesting_method: z.string().optional(),
  quality_details: z.string().optional(),
  farm_notes: z.string().optional(),
});
