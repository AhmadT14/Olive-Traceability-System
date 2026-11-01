// Every text shown on the Overview pages. Kept here so an Arabic copy can be
// added later without touching the components.

export const TEXT = {
  loading: "Loading your numbers",
  refresh: "Refresh",
  missing: "Not available yet",
  linksTitle: "Go to",
  table: "Show as a table",
  noData: "Nothing to show yet.",
  chartMissing: "This chart will appear once the system can provide the data.",
  batchUnit: "batches",
  jobUnit: "jobs",
  stages: {
    Farm: "Farm",
    Mill: "Olive mill",
    Storage: "Storage",
    Exporter: "Exporter",
    Importer: "Importer",
    Retailer: "Retailer",
  },

  farmer: {
    perMonth: "Batches created per month",
    perStage: "Where your batches are now",
  },

  transporter: {
    title: "Overview",
    open: "Open jobs you can claim",
    carrying: "Batches you are carrying",
    handedOver: "Handed over, waiting for receipt",
    completed: "Completed jobs",
    openByLeg: "Open jobs by route",
    completedByLeg: "Completed jobs by route",
    legs: {
      Farm: "Farm to mill",
      Mill: "Mill to storage",
      Storage: "Storage to exporter",
      Exporter: "Exporter to importer",
      Importer: "Importer to retailer",
    },
    completedNote:
      "Completed jobs will be counted once the system can list them.",
    links: [
      { to: "/transporter/jobs", label: "Job board" },
      { to: "/transporter/active", label: "My active jobs" },
    ],
  },

  facility: {
    title: "Overview",
    awaiting: "Waiting for you to confirm",
    holding: {
      mill: "In your mill, not listed yet",
      storage: "In your storage, not listed yet",
      exporter: "With you, not shipped yet",
      importer: "With you, not shipped yet",
      retailer: "In stock",
    },
    listed: "Listed, waiting for a transporter",
    received: "Batches received in total",
    receivedNote:
      "Batches received in total will be counted once the system can list them.",
    receivedPerMonth: "Batches received per month",
    quantityPerMonth: (unit) => `Quantity received per month (${unit})`,
    inbox: "Inbox",
    inventory: "Inventory",
  },

  admin: {
    title: "Overview",
    participants: "Participants",
    available: "Available",
    unavailable: "Marked unavailable",
    noRole: "Without a role",
    perRole: "Participants per role",
    perStage: "Batches per stage",
    participantUnit: "participants",
    links: [
      { to: "/admin/participants", label: "Participants" },
      { to: "/admin/participants/new", label: "Register participant" },
      { to: "/admin/participants/revoke", label: "Revoke a role" },
    ],
  },
};
