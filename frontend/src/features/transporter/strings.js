// Every text shown on the transporter pages. Kept here so an Arabic copy can
// be added later without touching the components.

export const TEXT = {
  product: { olive: "Olives", oil: "Olive oil" },
  unknownFacility: "Unknown facility",
  refresh: "Refresh",

  job: {
    product: "Product",
    from: "Pick up from",
    to: "Deliver to",
    listed: "Listed on",
    senderNotes: "What the sender recorded",
    noSenderNotes: "The sender recorded no outgoing details.",
  },

  status: {
    available: "Open",
    claimed: "Picked up",
    handover_pending: "Waiting for receipt",
    completed: "Delivered",
  },

  pending: {
    claim: (batchId) =>
      `Your pickup of batch ${batchId} is on chain, but its details were not saved yet.`,
    handover: (batchId) =>
      `Your delivery of batch ${batchId} is on chain, but its details were not saved yet.`,
    open: "Open it and retry saving",
    blocked:
      "Finish saving that one first. You cannot start another until it is saved.",
  },

  board: {
    title: "Job board",
    intro:
      "Batches waiting for a transporter. The first transporter to claim a job gets it.",
    loading: "Loading jobs",
    empty: "No jobs are waiting for pickup right now.",
    claim: "Claim this job",
    count: (n) => (n === 1 ? "1 open job" : `${n} open jobs`),
  },

  claim: {
    title: (batchId) => `Pick up batch ${batchId}`,
    intro:
      "Record the pickup, then sign the claim in your wallet. Quantities are in kilograms for olives and litres for oil.",
    loading: "Loading the job",
    gone: "This job is not on the board any more. Another transporter may have claimed it, or it was already picked up.",
    backToBoard: "Back to the job board",
    toMyJobs: "My active jobs",
    submit: "Claim and pick up",
    working: "Working",
  },

  claimed: {
    title: "Job claimed",
    intro: (batchId) => `Batch ${batchId} is now in your care.`,
    deliverTo: "Deliver it to",
    deliverNow: "Deliver and hand over",
    myJobs: "My active jobs",
    board: "Back to the job board",
  },

  deliver: {
    title: (batchId) => `Deliver batch ${batchId}`,
    intro:
      "Record the delivery, then sign the handover in your wallet. The receiver confirms it afterwards.",
    loading: "Loading the job",
    destination: "Hand over to",
    destinationHint: "Set when the batch was listed. It cannot be changed.",
    notMine: "This batch is not one of your active jobs.",
    alreadyHanded: (name) =>
      `You already handed this batch over. It is waiting for ${name} to confirm receipt.`,
    myJobs: "Back to my active jobs",
    submit: "Hand over",
    working: "Working",
  },

  delivered: {
    title: "Handed over",
    intro: (batchId) =>
      `Batch ${batchId} is waiting for the receiver to confirm receipt.`,
    receiver: "Receiver",
    openBatch: "Open the batch page",
    myJobs: "My active jobs",
    board: "Job board",
  },

  myJobs: {
    title: "My jobs",
    active: "Active jobs",
    activeEmpty: "You have no active jobs. Claim one from the job board.",
    completed: "Completed jobs",
    completedEmpty: "No completed jobs yet.",
    completedMissing:
      "Completed jobs will appear here once the system supports it.",
    loading: "Loading your jobs",
    deliver: "Deliver",
    columns: {
      batchId: "Batch ID",
      product: "Product",
      from: "From",
      to: "To",
      status: "Status",
      listed: "Listed on",
      action: "",
    },
  },
};
