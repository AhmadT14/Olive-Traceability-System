// Every text shown on the mill pages. Kept here so an Arabic copy can be
// added later without touching the components.

export const TEXT = {
  refresh: "Refresh",
  loading: "Loading",

  pending: {
    intake: (batchId) =>
      `Your receipt of batch ${batchId} is on chain, but its details were not saved yet.`,
    listing: (batchId) =>
      `Your listing of batch ${batchId} is on chain, but its details were not saved yet.`,
  },

  inbox: {
    title: "Mill inbox",
    loading: "Loading your batches",
    awaiting: "Waiting for your confirmation",
    awaitingEmpty: "No deliveries are waiting for you.",
    holding: "In your mill",
    holdingEmpty: "No batches in your mill.",
    listed: "Listed for pickup",
    listedEmpty: "No oil is waiting for a transporter.",
    confirm: "Confirm receipt",
    press: "Record pressing and list",
    label: "Print label",
    stats: {
      awaiting: "Waiting for confirmation",
      holding: "In your mill",
      listed: "Waiting for a transporter",
    },
    columns: {
      batchId: "Batch ID",
      broughtBy: "Brought by",
      stage: "Stage",
      goingTo: "Going to",
      status: "Status",
      action: "",
    },
  },

  records: {
    farm: "Farm record",
    delivery: "Transporter delivery record",
    none: "No details were saved for this step.",
  },

  intake: {
    title: (batchId) => `Confirm receipt of batch ${batchId}`,
    intro:
      "Check the olives against the records below, fill in what you received, then sign the receipt in your wallet. Quantities are in kilograms.",
    broughtBy: "Brought by",
    notForYou: "This batch is not waiting for your confirmation.",
    alreadyHere: "You already confirmed this batch. It is in your mill.",
    toList: "Record pressing and list",
    toInbox: "Back to the inbox",
    submit: "Confirm receipt",
    working: "Working",
  },

  received: {
    title: "Olives received",
    intro: (batchId) =>
      `Batch ${batchId} is now in your mill. When the oil is pressed, record it and list it for a storage facility.`,
    toList: "Record pressing and list",
    openBatch: "Open the batch page",
    toInbox: "Back to the inbox",
  },

  list: {
    title: (batchId) => `Press and list batch ${batchId}`,
    intro:
      "Record the pressing and pick the storage facility. Signing lists the oil for pickup, and a transporter can then claim it. Quantities are in litres.",
    storage: "Storage facility *",
    noStorage: "No storage facility is available",
    pickStorage: "Pick a storage facility.",
    loadingStorage: "Loading storage facilities",
    qrTitle: "QR label",
    qrHint:
      "Consumers scan this to see the batch journey. The QR code reference below points to it.",
    printLabel: "Print label",
    notReady: "This batch is not in your mill, so you cannot list it.",
    alreadyListed:
      "This batch is already listed for pickup and is waiting for a transporter.",
    toInbox: "Back to the inbox",
    submit: "List for pickup",
    working: "Working",
  },

  listed: {
    title: "Oil listed for pickup",
    intro: (batchId) =>
      `Batch ${batchId} is on the job board. A transporter can now claim it.`,
    goingTo: "Going to",
    printLabel: "Print label",
    openBatch: "Open the batch page",
    toInbox: "Back to the inbox",
  },

  label: {
    brand: "Olive Traceability",
    scan: "Scan to see where this olive oil comes from",
    batch: "Batch",
    print: "Print",
    back: "Back to the inbox",
  },
};
