import { z } from "zod";
import {
  addressSchema,
  batchIdSchema,
  quantitySchema,
  txHashSchema,
} from "./common.schemas.js";

// Required on both the prepare and the save step, and the two must agree: the
// hash the wallet signs is computed from exactly these values.
const requiredBatchFields = {
  harvest_date: z.string().trim().min(1),
  location: z.string().trim().min(1).max(255),
  olive_type: z.string().trim().min(1).max(128),
};

export const createBatchSchema = z.object({
  txHash: txHashSchema,
  batchId: batchIdSchema,
  ...requiredBatchFields,
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
  ...requiredBatchFields,
  quantity: quantitySchema.optional(),
  cultivation_method: z.string().optional(),
  irrigation_method: z.string().optional(),
  fertilizer_details: z.string().optional(),
  pesticide_details: z.string().optional(),
  harvesting_method: z.string().optional(),
  quality_details: z.string().optional(),
  farm_notes: z.string().optional(),
});
