// Default Anvil accounts 0 to 7. Names and locations match
// backend/scripts/seed-db.js. The admin (account 0) has no profile there.
export const MOCK_ACCOUNTS = {
  admin: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
  farmer: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  mill: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  transporter: "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
  storage: "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
  exporter: "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc",
  importer: "0x976ea74026e726554db657fa54763abd0c3a0aa9",
  retailer: "0x14dc79964da2c08b23698b3d3cc7ca32193d9955",
};

const PROFILES = {
  [MOCK_ACCOUNTS.farmer]: {
    name: "Nablus Hills Farm",
    location: "Nablus",
    roles: ["FARMER"],
  },
  [MOCK_ACCOUNTS.mill]: {
    name: "Al-Salam Olive Mill",
    location: "Jenin",
    roles: ["MILL"],
  },
  [MOCK_ACCOUNTS.transporter]: {
    name: "Al-Amal Transport",
    location: "Ramallah",
    roles: ["TRANSPORTER"],
  },
  [MOCK_ACCOUNTS.storage]: {
    name: "Hebron Oil Storage",
    location: "Hebron",
    roles: ["STORAGE"],
  },
  [MOCK_ACCOUNTS.exporter]: {
    name: "Palestine Olive Exports",
    location: "Ramallah",
    roles: ["EXPORTER"],
  },
  [MOCK_ACCOUNTS.importer]: {
    name: "Levant Gourmet Imports",
    location: "Amman",
    roles: ["IMPORTER"],
  },
  [MOCK_ACCOUNTS.retailer]: {
    name: "Green Table Market",
    location: "Amman",
    roles: ["RETAILER"],
  },
};

// Roles for each account, as login returns them.
export function mockRoles(address) {
  const profile = PROFILES[String(address).toLowerCase()];
  return profile ? profile.roles : [];
}

// Shape of GET /participants/:address/profile; null stands for the 404.
export function profileMock(address) {
  const key = String(address).toLowerCase();
  const profile = PROFILES[key];
  return profile ? { address: key, ...profile } : null;
}

// Shape of GET /destinations?role=MILL.
export async function millDestinationsMock() {
  return {
    role: "MILL",
    destinations: [
      {
        address: MOCK_ACCOUNTS.mill,
        name: PROFILES[MOCK_ACCOUNTS.mill].name,
        role: "MILL",
      },
    ],
  };
}
