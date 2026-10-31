// Every text shown on the facility pages (mill, storage, exporter, importer,
// retailer). Kept here so an Arabic copy can be added later without touching
// the components. Role specific words are under `roles`.

export const TEXT = {
  refresh: "Refresh",
  loading: "Loading",

  roles: {
    mill: {
      inbox: "Mill inbox",
      holding: "In your mill",
      holdingEmpty: "No batches in your mill.",
      product: "olives",
      unit: "kilograms",
      next: "a storage facility",
      destination: "Storage facility *",
      list: "Record pressing and list",
      listTitle: (id) => `Press and list batch ${id}`,
      listIntro:
        "Record the pressing and pick the storage facility. Signing lists the oil for pickup, and a transporter can then claim it. Quantities are in litres.",
    },
    storage: {
      inbox: "Storage inbox",
      holding: "In your storage",
      holdingEmpty: "No batches in your storage.",
      product: "oil",
      unit: "litres",
      next: "an exporter",
      destination: "Exporter *",
      list: "Release and list",
      listTitle: (id) => `Release and list batch ${id}`,
      listIntro:
        "Record the release from storage and pick the exporter. Signing lists the oil for pickup, and a transporter can then claim it. Quantities are in litres.",
    },
    exporter: {
      inbox: "Exporter inbox",
      holding: "With you",
      holdingEmpty: "No batches with you.",
      product: "oil",
      unit: "litres",
      next: "an importer",
      destination: "Importer *",
      list: "Ship and list",
      listTitle: (id) => `Ship and list batch ${id}`,
      listIntro:
        "Record the shipment and pick the importer. Signing lists the oil for pickup, and a transporter can then claim it. Quantities are in litres.",
    },
    importer: {
      inbox: "Importer inbox",
      holding: "With you",
      holdingEmpty: "No batches with you.",
      product: "oil",
      unit: "litres",
      next: "a retailer",
      destination: "Retailer *",
      list: "Ship and list",
      listTitle: (id) => `Ship and list batch ${id}`,
      listIntro:
        "Record the shipment and pick the retailer. Signing lists the oil for pickup, and a transporter can then claim it. Quantities are in litres.",
    },
    retailer: {
      inbox: "Retailer inbox",
      holding: "In your shop",
      holdingEmpty: "No batches in your shop yet.",
      product: "oil",
      unit: "litres",
    },
  },

  pending: {
    intake: (batchId) =>
      `Your receipt of batch ${batchId} is on chain, but its details were not saved yet.`,
    listing: (batchId) =>
      `Your listing of batch ${batchId} is on chain, but its details were not saved yet.`,
  },

  inbox: {
    loading: "Loading your batches",
    awaiting: "Waiting for your confirmation",
    awaitingEmpty: "No deliveries are waiting for you.",
    listed: "Listed for pickup",
    listedEmpty: "Nothing is waiting for a transporter.",
    confirm: "Confirm receipt",
    label: "Print label",
    toInventory: "Open your inventory",
    stats: {
      awaiting: "Waiting for confirmation",
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

  inventory: {
    title: "Inventory",
    intro:
      "Oil you received and that reached the end of its journey. Customers scan the QR code to see where it comes from.",
    publicPage: "Public page",
    label: "Print label",
    columns: { batchId: "Batch ID", page: "", label: "" },
  },

  records: {
    sender: {
      Farm: "Farm record",
      Mill: "Mill pressing record",
      Storage: "Storage release record",
      Exporter: "Exporter shipment record",
      Importer: "Importer shipment record",
    },
    delivery: "Transporter delivery record",
    none: "No details were saved for this step.",
  },

  intake: {
    title: (batchId) => `Confirm receipt of batch ${batchId}`,
    intro: (product, unit) =>
      `Check the ${product} against the records below, fill in what you received, then sign the receipt in your wallet. Quantities are in ${unit}.`,
    broughtBy: "Brought by",
    notForYou: "This batch is not waiting for your confirmation.",
    alreadyHere: "You already confirmed this batch. It is with you now.",
    toInbox: "Back to the inbox",
    submit: "Confirm receipt",
    working: "Working",
  },

  received: {
    title: "Batch received",
    intro: (batchId, next) =>
      `Batch ${batchId} is now with you. When it is ready, record it and list it for ${next}.`,
    openBatch: "Open the batch page",
    toInbox: "Back to the inbox",
  },

  journeyEnd: {
    title: "End of the journey",
    intro: (batchId) =>
      `Batch ${batchId} is in your shop. This is the last step of its journey. Customers can scan the QR code to see every step from the farm.`,
    link: "Public page",
    qrHint: "Print it for the shelf or the bottles.",
    printLabel: "Print label",
    openPublic: "Open the public page",
    toInventory: "Open your inventory",
  },

  list: {
    pick: "Pick where it goes.",
    none: "No facility is available",
    loadingOptions: "Loading the facilities",
    qrTitle: "QR label",
    qrHint:
      "Consumers scan this to see the batch journey. The QR code reference below points to it.",
    printLabel: "Print label",
    notReady: "This batch is not with you, so you cannot list it.",
    intakeFirst:
      "Save the receipt details of this batch before you list it, so its history has no gap.",
    alreadyListed:
      "This batch is already listed for pickup and is waiting for a transporter.",
    toInbox: "Back to the inbox",
    submit: "List for pickup",
    working: "Working",
  },

  listed: {
    title: "Listed for pickup",
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
    back: "Back",
  },
};
