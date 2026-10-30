import { z } from "zod";
import { quantitySchema } from "./common.schemas.js";

export const millReceiptSchema = z.object({
  arrival_condition: z.string().optional(),
  quantity_received: quantitySchema.optional(),
  olive_quality: z.string().optional(),
  storage_condition: z.string().optional(),
  notes: z.string().optional(),
});

export const storageReceiptSchema = z.object({
  quantity_received: quantitySchema.optional(),
  storage_start_date: z.string().optional(),
  expected_duration: z.number().int().optional(),
  conditions: z.string().optional(),
  product_condition: z.string().optional(),
  notes: z.string().optional(),
});

export const exporterReceiptSchema = z.object({
  quantity_received: quantitySchema.optional(),
  shipment_arrival_details: z.string().optional(),
  received_product_details: z.string().optional(),
  product_condition: z.string().optional(),
  notes: z.string().optional(),
});

export const importerReceiptSchema = exporterReceiptSchema;

export const retailerReceiptSchema = z.object({
  quantity_received: quantitySchema.optional(),
  final_receipt_details: z.string().optional(),
  product_condition: z.string().optional(),
  notes: z.string().optional(),
});

// Keyed by the stage the batch is in once the receipt is confirmed, which is the
// receiving participant's own stage. confirmReceipt advances the stage, so a
// receipt that is still being prepared looks up the stage after the batch's
// current one (see prepareReceipt).
export const receiptSchemas = {
  Mill: {
    hashStage: "mill_olive",
    role: "MILL",
    detailsType: "mill_intake",
    schema: millReceiptSchema,
  },
  Storage: {
    hashStage: "storage",
    role: "STORAGE",
    detailsType: "storage_intake",
    schema: storageReceiptSchema,
  },
  Exporter: {
    hashStage: "exporter_intake",
    role: "EXPORTER",
    detailsType: "exporter_intake",
    schema: exporterReceiptSchema,
  },
  Importer: {
    hashStage: "import",
    role: "IMPORTER",
    detailsType: "importer_intake",
    schema: importerReceiptSchema,
  },
  Retailer: {
    hashStage: "retail",
    role: "RETAILER",
    detailsType: "retailer_intake",
    schema: retailerReceiptSchema,
  },
};
