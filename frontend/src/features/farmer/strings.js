// Every text shown on the farmer pages. Kept here so an Arabic copy can be
// added later without touching the components.

export const TEXT = {
  overview: {
    title: "My batches",
    create: "Create batch",
    refresh: "Refresh",
    total: "Batches created",
    waiting: "Waiting for pickup at your farm",
    onTheWay: "On the way to the mill",
    atMill: "Delivered to the mill",
    empty: "You have not created any batches yet.",
    loading: "Loading your batches",
    columns: {
      batchId: "Batch ID",
      harvest: "Harvest date",
      stage: "Stage",
      status: "Status",
      heldBy: "Held by",
      oliveType: "Olive type",
      quantity: "Quantity (kg)",
    },
    filters: {
      status: "Status",
      allStatuses: "All statuses",
      oliveType: "Olive type",
      allTypes: "All olive types",
      sort: "Sort by",
      sorts: {
        newest: "Newest first",
        oldest: "Oldest first",
        harvestNewest: "Harvest date, newest first",
        harvestOldest: "Harvest date, oldest first",
        quantityHighest: "Quantity, highest first",
        quantityLowest: "Quantity, lowest first",
      },
      reset: "Reset filters",
      showing: (shown, total) => `Showing ${shown} of ${total}`,
      noMatch: "No batches match these filters.",
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
    noMillsHint:
      "No mill is registered and available right now, so a batch cannot be created yet. Try again later or contact the ministry.",
    millsFailed: "Could not load the mills",
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
