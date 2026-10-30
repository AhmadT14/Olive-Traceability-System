import { z } from "zod";
import {
  addressSchema,
  batchIdSchema,
  quantitySchema,
  txHashSchema,
} from "./common.schemas.js";

const pickupFields = {
  truck_details: z.string().optional(),
  quantity_picked_up: quantitySchema.optional(),
  loading_details: z.string().optional(),
  transport_conditions: z.string().optional(),
  notes: z.string().optional(),
};

export const olivePickupSchema = z.object({
  txHash: txHashSchema,
  ...pickupFields,
  pickup_condition: z.string().optional(),
  olive_condition: z.string().optional(),
});

export const oilPickupSchema = z.object({
  txHash: txHashSchema,
  ...pickupFields,
  oil_condition: z.string().optional(),
  packaging_condition: z.string().optional(),
});

const deliveryFields = {
  txHash: txHashSchema,
  quantity_delivered: quantitySchema.optional(),
  unloading_details: z.string().optional(),
  transport_conditions: z.string().optional(),
  notes: z.string().optional(),
};

export const oliveDeliverySchema = z.object({
  ...deliveryFields,
  olive_condition: z.string().optional(),
});

export const oilDeliverySchema = z.object({
  ...deliveryFields,
  oil_condition: z.string().optional(),
  packaging_condition: z.string().optional(),
});

// A transaction hash only exists after the wallet has sent the transaction, so
// the prepare step takes the record fields without one.
export const prepareOlivePickupSchema = olivePickupSchema
  .omit({ txHash: true })
  .extend({ batchId: batchIdSchema });
export const prepareOilPickupSchema = oilPickupSchema
  .omit({ txHash: true })
  .extend({ batchId: batchIdSchema });
export const prepareOliveDeliverySchema = oliveDeliverySchema
  .omit({ txHash: true })
  .extend({ batchId: batchIdSchema, targetAddress: addressSchema });
export const prepareOilDeliverySchema = oilDeliverySchema
  .omit({ txHash: true })
  .extend({ batchId: batchIdSchema, targetAddress: addressSchema });
