// Custody status from GET /batches/:id/chain.
export const STATUS = {
  Created: { label: "Held by custodian", tone: "success" },
  Listed: { label: "Waiting for pickup", tone: "warning" },
  PendingHandover: { label: "Waiting for receipt", tone: "warning" },
};
