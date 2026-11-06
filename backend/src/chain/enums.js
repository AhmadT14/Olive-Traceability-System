import { id } from "ethers";

export const Status = ["None", "Created", "Listed", "PendingHandover"];
export const Stage = [
  "Farm",
  "Mill",
  "Storage",
  "Exporter",
  "Importer",
  "Retailer",
];
export const RoleNames = [
  "FARMER",
  "TRANSPORTER",
  "MILL",
  "STORAGE",
  "EXPORTER",
  "IMPORTER",
  "RETAILER",
];

export const ROLES = Object.fromEntries(
  RoleNames.map((name) => [name, id(`${name}_ROLE`)]),
);

export const StageRole = {
  Farm: "FARMER",
  Mill: "MILL",
  Storage: "STORAGE",
  Exporter: "EXPORTER",
  Importer: "IMPORTER",
  Retailer: "RETAILER",
};

export const batchExists = (batch) => batch.status !== Status[0];
