// Every text shown on the farmer pages. Kept here so an Arabic copy can be
// added later without touching the components.

export const TEXT = {
  overview: {
    title: "My batches",
    create: "Create batch",
    refresh: "Refresh",
    total: "Batches",
    waiting: "Waiting for pickup at your farm",
    partial:
      "This list shows only batches that are still waiting for pickup. Batches already on their way will appear here once the system supports it.",
    empty: "You have not created any batches yet.",
    loading: "Loading your batches",
    columns: {
      batchId: "Batch ID",
      harvest: "Harvest date",
      stage: "Stage",
      status: "Status",
      heldBy: "Held by",
    },
  },

  create: {
    title: "Create a batch",
    intro: "Fields marked * are required. Quantities are in kilograms.",
    batchId: "Batch ID",
    batchIdHint:
      "Made automatically from the farm location and the harvest year.",
    mill: "Destination mill *",
    noMills: "No mills found",
    pickMill: "Pick a mill.",
    loadingMills: "Loading mills",
    checking: "Checking the batch ID",
    idFailed: "Could not find a free batch ID. Try again.",
    submit: "Create batch",
    working: "Working",
  },

  done: {
    title: "Batch created",
    intro: "The batch is on the blockchain and is now waiting for a transporter.",
    batchId: "Batch ID",
    openBatch: "Open the batch page",
    publicLink: "Public page for consumers",
    another: "Create another batch",
    overview: "Back to my batches",
  },
};
