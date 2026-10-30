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
    { path: "/transporter/jobs", label: "Job board" },
    { path: "/transporter/active", label: "My active jobs" },
  ],
  mill: [{ path: "/mill/inbox", label: "Inbox" }],
  storage: [{ path: "/storage/inbox", label: "Inbox" }],
  exporter: [{ path: "/exporter/inbox", label: "Inbox" }],
  importer: [{ path: "/importer/inbox", label: "Inbox" }],
  retailer: [
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
