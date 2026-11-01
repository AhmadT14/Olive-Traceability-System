export const ROLE_LABELS = {
  admin: "Admin",
  farmer: "Farmer",
  transporter: "Transporter",
  mill: "Olive mill",
  storage: "Storage",
  exporter: "Exporter",
  importer: "Importer",
  retailer: "Retailer",
};

// Registry role names as the API takes them (admin role routes, roles lookup).
export const PARTICIPANT_ROLES = [
  "FARMER",
  "TRANSPORTER",
  "MILL",
  "STORAGE",
  "EXPORTER",
  "IMPORTER",
  "RETAILER",
];

// "MILL" -> "Olive mill".
export const roleLabel = (role) =>
  ROLE_LABELS[String(role).toLowerCase()] || role;

// Sidebar links per role, taken from the route map in docs/frontend-plan.md.
// The first link is the role's home.
export const ROLE_NAV = {
  admin: [
    { path: "/admin", label: "Overview" },
    { path: "/admin/participants", label: "Participants" },
    { path: "/admin/participants/new", label: "Register participant" },
    { path: "/admin/participants/revoke", label: "Revoke a role" },
  ],
  farmer: [
    { path: "/farmer", label: "Overview" },
    { path: "/farmer/batches/new", label: "Create batch" },
  ],
  transporter: [
    { path: "/transporter", label: "Overview" },
    { path: "/transporter/jobs", label: "Job board" },
    { path: "/transporter/active", label: "My active jobs" },
  ],
  mill: [
    { path: "/mill", label: "Overview" },
    { path: "/mill/inbox", label: "Inbox" },
  ],
  storage: [
    { path: "/storage", label: "Overview" },
    { path: "/storage/inbox", label: "Inbox" },
  ],
  exporter: [
    { path: "/exporter", label: "Overview" },
    { path: "/exporter/inbox", label: "Inbox" },
  ],
  importer: [
    { path: "/importer", label: "Overview" },
    { path: "/importer/inbox", label: "Inbox" },
  ],
  retailer: [
    { path: "/retailer", label: "Overview" },
    { path: "/retailer/inbox", label: "Inbox" },
    { path: "/retailer/inventory", label: "Inventory" },
  ],
};

export const ROLE_HOME = Object.fromEntries(
  Object.entries(ROLE_NAV).map(([role, links]) => [role, links[0].path]),
);

// Links every signed in role sees under its own links.
export const SHARED_NAV = [
  { path: "/batches", label: "Find a batch" },
  { path: "/settings", label: "Settings" },
];
