// Names for the default Anvil accounts 0 to 7 (gap 6: no public profile route).
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
  [MOCK_ACCOUNTS.admin]: {
    name: "Ministry of Agriculture",
    location: "Ramallah",
  },
  [MOCK_ACCOUNTS.farmer]: { name: "Al Zaytoun Farm", location: "Jenin" },
  [MOCK_ACCOUNTS.mill]: { name: "Nablus Olive Mill", location: "Nablus" },
  [MOCK_ACCOUNTS.transporter]: {
    name: "Green Road Transport",
    location: "Tulkarm",
  },
  [MOCK_ACCOUNTS.storage]: { name: "Hebron Oil Storage", location: "Hebron" },
  [MOCK_ACCOUNTS.exporter]: { name: "Holy Land Exports", location: "Ramallah" },
  [MOCK_ACCOUNTS.importer]: { name: "Amman Olive Imports", location: "Amman" },
  [MOCK_ACCOUNTS.retailer]: { name: "Bethlehem Market", location: "Bethlehem" },
};

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
