import { z } from "zod";
import {
  addressSchema,
  batchIdSchema,
  quantitySchema,
} from "./common.schemas.js";

const destination = {
  batchId: batchIdSchema,
  destinationAddress: addressSchema,
};

const oilFields = {
  product_condition: z.string().optional(),
  packaging_condition: z.string().optional(),
  notes: z.string().optional(),
};

export const millListingSchema = z.object({
  ...destination,
  pressing_date: z.string().optional(),
  extraction_method: z.string().optional(),
  output_quantity: quantitySchema.optional(),
  oil_quality: z.string().optional(),
  packaging_details: z.string().optional(),
  qr_code_reference: z.string().optional(),
  notes: z.string().optional(),
});

export const storageListingSchema = z.object({
  ...destination,
  quantity_released: quantitySchema.optional(),
  storage_end_date: z.string().optional(),
  ...oilFields,
  loading_details: z.string().optional(),
});

export const exporterListingSchema = z.object({
  ...destination,
  quantity_shipped: quantitySchema.optional(),
  shipment_details: z.string().optional(),
  ...oilFields,
});

export const importerListingSchema = exporterListingSchema;
