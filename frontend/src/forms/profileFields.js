// Role-specific profile `details` per API role. `name` is the exact key the
// backend validates (profileDetailsSchemas in
// backend/src/validation/participant.schemas.js); API.md does not list them
// yet. Capacities take free text, because the backend gives no unit.

const text = (name, label, max) => ({ name, label, type: "text", max });
const area = (name, label) => ({ name, label, type: "textarea" });

export const PROFILE_DETAILS = {
  FARMER: [
    text("farmName", "Farm name", 255),
    area("certificationDetails", "Certifications"),
  ],
  TRANSPORTER: [
    text("companyName", "Company name", 255),
    area("vehicleDetails", "Vehicles"),
    area("licenseDetails", "Transport license"),
  ],
  MILL: [
    text("facilityName", "Facility name", 255),
    text("processingCapacity", "Processing capacity"),
    area("certificationDetails", "Certifications"),
  ],
  STORAGE: [
    text("facilityName", "Facility name", 255),
    text("storageCapacity", "Storage capacity"),
    area("storageConditions", "Storage conditions"),
    area("certificationDetails", "Certifications"),
  ],
  EXPORTER: [
    text("companyName", "Company name", 255),
    area("exportLicenseDetails", "Export license"),
    area("destinationMarkets", "Destination markets"),
  ],
  IMPORTER: [
    text("businessName", "Business name", 255),
    area("importLicenseDetails", "Import license"),
    area("distributionDetails", "Distribution"),
  ],
  RETAILER: [
    text("businessName", "Business name", 255),
    area("retailLicenseDetails", "Retail license"),
    text("businessType", "Business type", 128),
  ],
};
