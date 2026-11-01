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

// Changes made on the admin pages, on top of PROFILES: `roles` stands for the
// registry on chain, `profiles` for the database rows. Kept in localStorage
// like the mock chain, and cleared with it by "Reset mock data".
const STORE_KEY = "olive_mock_participants";

function loadChanges() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved) return saved;
  } catch {
    /* storage unavailable */
  }
  return { roles: {}, profiles: {} };
}

function saveChanges(changes) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(changes));
  } catch {
    /* storage unavailable */
  }
}

export function resetMockParticipants() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* storage unavailable */
  }
}

// The stored profile fields of a wallet (no roles), or null when the
// database has no row for it.
export function storedProfile(address) {
  const key = String(address).toLowerCase();
  const seeded = PROFILES[key];
  const changed = loadChanges().profiles[key];
  if (!seeded && !changed) return null;
  const fields = { ...seeded };
  delete fields.roles;
  return { ...fields, ...changed };
}

// Every wallet with a database row, in address order like the backend.
function profileAddresses() {
  const changed = Object.keys(loadChanges().profiles);
  return [...new Set([...Object.keys(PROFILES), ...changed])].sort();
}

// Roles for each account, as login returns them.
export function mockRoles(address) {
  const key = String(address).toLowerCase();
  const changed = loadChanges().roles[key];
  if (changed) return changed;
  return PROFILES[key] ? PROFILES[key].roles : [];
}

// The mock chain grants or revokes a role.
export function setMockRoles(address, roles) {
  const changes = loadChanges();
  changes.roles[String(address).toLowerCase()] = roles;
  saveChanges(changes);
}

// Like the backend upsert: sent fields replace the stored ones.
export function saveMockProfile(address, profile) {
  const changes = loadChanges();
  const key = String(address).toLowerCase();
  changes.profiles[key] = { ...changes.profiles[key], ...profile };
  saveChanges(changes);
}

// Shape of GET /participants/:address/profile; null stands for the 404.
export function profileMock(address) {
  const key = String(address).toLowerCase();
  const profile = storedProfile(key);
  if (!profile) return null;
  return {
    address: key,
    name: profile.name ?? null,
    location: profile.location ?? null,
    roles: mockRoles(key),
  };
}

// Shape of GET /participants/:address/roles.
export async function participantRolesMock(address) {
  return { address, roles: mockRoles(address) };
}

// Registered participants holding `role`, as destination entries.
export function participantsWithRole(role) {
  return profileAddresses()
    .filter((address) => mockRoles(address).includes(role))
    .map((address) => ({
      address,
      name: storedProfile(address).name,
      role,
    }));
}

// Shape of GET /admin/participants, without the admin check.
export function directoryMock() {
  return profileAddresses().map((address) => {
    const p = storedProfile(address);
    return {
      address,
      name: p.name ?? null,
      location: p.location ?? null,
      availability: p.availability ?? null,
      roles: mockRoles(address),
    };
  });
}

// Shape of GET /destinations?role=MILL.
export async function millDestinationsMock() {
  return { role: "MILL", destinations: participantsWithRole("MILL") };
}
