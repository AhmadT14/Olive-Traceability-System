// Every text shown on the public pages. An Arabic copy of this file is added
// in Phase 10, so keep user-facing words here and out of the components.

export const TEXT = {
  brand: "Olive Traceability",

  landing: {
    title: "Where does your olive oil come from?",
    intro:
      "Enter the batch code printed on the label, or scan the QR code, to follow the oil from the farm to the shop.",
    search: {
      label: "Batch code",
      placeholder: "For example DEMO-1",
      submit: "Trace this batch",
      empty: "Enter the batch code from the label.",
      tooLong: "A batch code has at most 64 characters.",
    },
    mockHint: "Mock mode is on. Try DEMO-1, DEMO-2, DEMO-3 or B1.",
    members: "Farm, mill or other supply chain member?",
    signIn: "Sign in",
    status: "System status",
    checking: "Checking",
    connected: "Connected",
    unreachable: "Not reachable",
  },

  trace: {
    batch: "Batch",
    product: { olives: "Olives", oil: "Olive oil" },
    now: {
      Created: "Now at",
      Listed: "Waiting for pickup at",
      PendingHandover: "Delivered to",
    },
    pendingSuffix: "waiting for them to confirm",
    loading: "Loading the journey of this batch",
    notFoundTitle: "Batch not found",
    notFound:
      "We could not find this batch. Check the code on the label and try again.",
    error: "We could not load this batch right now. Try again in a moment.",
    retry: "Try again",
    another: "Check another batch",
    journeyTitle: "The journey",
    notYet: "Not yet",
    noDetails: "The details for this step were not saved.",
    unknownFacility: "Registered participant",
    stages: {
      Farm: { title: "Grown and harvested", role: "Farm" },
      Mill: { title: "Pressed into oil", role: "Olive mill" },
      Storage: { title: "Stored", role: "Storage" },
      Exporter: { title: "Exported", role: "Exporter" },
      Importer: { title: "Imported", role: "Importer" },
      Retailer: { title: "At the shop", role: "Retailer" },
    },
    records: {
      BatchCreated: "Harvest",
      ReceiptConfirmed: "On arrival",
      BatchListed: "Before leaving",
      BatchClaimed: "Pickup",
      HandoverInitiated: "Delivery",
    },
    transport: {
      by: "Transported by",
      inTransit: "On the road with",
      details: "Transport details",
    },
    footer:
      "Each member of the supply chain records its own step. A fingerprint of every record is stored on the blockchain, so a later change to a record shows up on this page.",
  },

  integrity: {
    verified: {
      title: "Verified on the blockchain",
      text: "Every record on this page matches the fingerprint stored on the blockchain when it was made. Nobody has changed them since.",
    },
    mismatch: {
      title: "Records do not match",
      text: "At least one record on this page was changed after it was registered on the blockchain. Treat this batch with caution.",
    },
    incomplete: {
      title: "Partly verified",
      text: "Some steps have no saved records yet, so they could not be checked.",
    },
    unavailable: {
      title: "Records not checked",
      text: "The check against the blockchain did not answer. The journey is shown without it.",
    },
    checking: "Checking the records against the blockchain",
    proof: "Show the blockchain proof",
    step: "Step",
    block: "Block",
    transaction: "Transaction",
    result: "Result",
    status: {
      verified: "Matches",
      hash_mismatch: "Changed",
      metadata_mismatch: "Wrong record type",
      event_not_found_on_chain: "Not on the blockchain",
      unverifiable: "Cannot be checked",
      none: "No record saved",
    },
  },

  events: {
    BatchCreated: "Registered by the farm",
    BatchListed: "Listed for pickup",
    BatchClaimed: "Picked up",
    HandoverInitiated: "Delivered",
    ReceiptConfirmed: "Receipt confirmed",
  },
};
