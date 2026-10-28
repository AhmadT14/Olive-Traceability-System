import { z } from "zod";
import {
  batchIdSchema,
  txHashSchema,
  walletAddressSchema,
} from "./common.schemas.js";

// Schemas for values that arrive outside the JSON body: path parameters and
// query strings. They are parsed by validation/parse.js, which keeps each
// endpoint's existing 400 message instead of exposing Zod's wording.
export const batchIdParamSchema = batchIdSchema;
export const txHashParamSchema = txHashSchema;
export const walletAddressParamSchema = walletAddressSchema;

// The only supported pre-batch destination lookup is a mill. Accept any case
// for backwards compatibility, then normalise the result.
export const destinationRoleQuerySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.literal("MILL"));
