// Every text shown on the Overview pages. Kept here so an Arabic copy can be
// added later without touching the components.

export const TEXT = {
  loading: "Loading your numbers",
  refresh: "Refresh",
  missing: "Not available yet",
  linksTitle: "Go to",

  transporter: {
    title: "Overview",
    open: "Open jobs you can claim",
    carrying: "Batches you are carrying",
    handedOver: "Handed over, waiting for receipt",
    completed: "Completed jobs",
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
    inbox: "Inbox",
    inventory: "Inventory",
  },

  admin: {
    title: "Overview",
    participants: "Participants",
    available: "Available",
    unavailable: "Marked unavailable",
    noRole: "Without a role",
    links: [
      { to: "/admin/participants", label: "Participants" },
      { to: "/admin/participants/new", label: "Register participant" },
      { to: "/admin/participants/revoke", label: "Revoke a role" },
    ],
  },
};
