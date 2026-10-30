// Stores the demo participants (name, location, role details) in PostgreSQL so
// that /destinations and POST /batches/prepare can find them. The roles
// themselves are registered on chain by scripts/seed.sh.
//
// Wallets are Anvil's dev accounts 1-7 (account 0 is the registry admin).
// Rows that already exist are left alone, so re-running never overwrites
// edits made through the API.
//
//   npm run db:seed
import { HDNodeWallet } from "ethers";
import { hasRole } from "../src/chain/reader.js";
import { db } from "../src/db/db.js";
import { participantProfiles, participants } from "../src/db/schema.js";
import { validateProfileDetails } from "../src/validation/participant.schemas.js";

const ANVIL_MNEMONIC =
  "test test test test test test test test test test test junk";
const accountAddress = (index) =>
  HDNodeWallet.fromPhrase(ANVIL_MNEMONIC, undefined, `m/44'/60'/0'/0/${index}`)
    .address;

const DEMO_PARTICIPANTS = [
  {
    account: 1,
    role: "FARMER",
    name: "Nablus Hills Farm",
    location: "Nablus",
    contactPhone: "+970 59 000 0001",
    email: "farmer@example.test",
    details: {
      farmName: "Nablus Hills Farm",
      certificationDetails: "Organic certified",
    },
  },
  {
    account: 2,
    role: "MILL",
    name: "Al-Salam Olive Mill",
    location: "Jenin",
    contactPhone: "+970 59 000 0002",
    email: "mill@example.test",
    details: {
      facilityName: "Al-Salam Olive Mill",
      processingCapacity: 5000,
      certificationDetails: "ISO 22000",
    },
  },
  {
    account: 3,
    role: "TRANSPORTER",
    name: "Al-Amal Transport",
    location: "Ramallah",
    contactPhone: "+970 59 000 0003",
    email: "transporter@example.test",
    details: {
      companyName: "Al-Amal Transport",
      vehicleDetails: "Refrigerated truck, 8 t",
      licenseDetails: "Licensed carrier",
    },
  },
  {
    account: 4,
    role: "STORAGE",
    name: "Hebron Oil Storage",
    location: "Hebron",
    contactPhone: "+970 59 000 0004",
    email: "storage@example.test",
    details: {
      facilityName: "Hebron Oil Storage",
      storageCapacity: 20000,
      storageConditions: "Temperature controlled, stainless steel tanks",
      certificationDetails: "Food safety audited",
    },
  },
  {
    account: 5,
    role: "EXPORTER",
    name: "Palestine Olive Exports",
    location: "Ramallah",
    contactPhone: "+970 59 000 0005",
    email: "exporter@example.test",
    details: {
      companyName: "Palestine Olive Exports",
      exportLicenseDetails: "Export licence on file",
      destinationMarkets: "Jordan, Gulf states, Europe",
    },
  },
  {
    account: 6,
    role: "IMPORTER",
    name: "Levant Gourmet Imports",
    location: "Amman",
    contactPhone: "+962 7 0000 0006",
    email: "importer@example.test",
    details: {
      businessName: "Levant Gourmet Imports",
      importLicenseDetails: "Import licence on file",
      distributionDetails: "Regional distribution",
    },
  },
  {
    account: 7,
    role: "RETAILER",
    name: "Green Table Market",
    location: "Amman",
    contactPhone: "+962 7 0000 0007",
    email: "retailer@example.test",
    details: {
      businessName: "Green Table Market",
      retailLicenseDetails: "Retail licence on file",
      businessType: "Grocery",
    },
  },
];

let missingOnChain = 0;

for (const p of DEMO_PARTICIPANTS) {
  const address = accountAddress(p.account);
  const wallet = address.toLowerCase();
  const details = validateProfileDetails(p.role, p.details);

  await db
    .insert(participants)
    .values({ walletAddress: wallet })
    .onConflictDoNothing();
  await db
    .insert(participantProfiles)
    .values({
      walletAddress: wallet,
      name: p.name,
      contactPhone: p.contactPhone,
      email: p.email,
      location: p.location,
      availability: "available",
      details,
    })
    .onConflictDoNothing();

  const registered = await hasRole(p.role, address);
  if (!registered) missingOnChain += 1;
  console.log(
    `${p.role.padEnd(11)} ${address}  ${p.name}` +
      (registered
        ? ""
        : "  (role NOT registered on chain; run scripts/seed.sh)"),
  );
}

if (missingOnChain > 0) {
  console.warn(
    `${missingOnChain} participant(s) stored without an on-chain role. ` +
      "They will not appear in destination lists until the role is registered.",
  );
}
console.log("Participant seed done.");
process.exit(0);
