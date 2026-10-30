import { z } from "zod";
import { txHashSchema } from "./common.schemas.js";

export const profileDetailsSchemas = {
  FARMER: z.object({
    farmName: z.string().max(255).optional(),
    certificationDetails: z.string().optional(),
  }),
  TRANSPORTER: z.object({
    companyName: z.string().max(255).optional(),
    vehicleDetails: z.string().optional(),
    licenseDetails: z.string().optional(),
  }),
  MILL: z.object({
    facilityName: z.string().max(255).optional(),
    processingCapacity: z.union([z.string(), z.number()]).optional(),
    certificationDetails: z.string().optional(),
  }),
  STORAGE: z.object({
    facilityName: z.string().max(255).optional(),
    storageCapacity: z.union([z.string(), z.number()]).optional(),
    storageConditions: z.string().optional(),
    certificationDetails: z.string().optional(),
  }),
  EXPORTER: z.object({
    companyName: z.string().max(255).optional(),
    exportLicenseDetails: z.string().optional(),
    destinationMarkets: z.string().optional(),
  }),
  IMPORTER: z.object({
    businessName: z.string().max(255).optional(),
    importLicenseDetails: z.string().optional(),
    distributionDetails: z.string().optional(),
  }),
  RETAILER: z.object({
    businessName: z.string().max(255).optional(),
    retailLicenseDetails: z.string().optional(),
    businessType: z.string().max(128).optional(),
  }),
};

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  contactPhone: z.string().max(64).optional(),
  email: z.string().email().max(255).optional(),
  address: z.string().optional(),
  location: z.string().max(255).optional(),
  availability: z.string().max(32).optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const availabilityValues = ["available", "unavailable"];

export const updateAvailabilitySchema = z.object({
  availability: z.enum(availabilityValues),
});

// A participant edits their own profile field by field. Availability has its
// own endpoint, so it is not accepted here.
export const updateProfileSchema = profileSchema
  .omit({ availability: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "provide at least one field to update",
  });

export const validateProfileDetails = (role, details) => {
  const schema = profileDetailsSchemas[role];
  if (!schema)
    throw new Error(`No profile schema registered for role "${role}"`);
  return schema.parse(details ?? {});
};

export const roleChangeIdentity = {
  address: z.string(),
  role: z.string(),
  txHash: txHashSchema,
};
