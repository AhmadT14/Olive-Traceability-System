import Badge from "../Badge";

const STATUS = {
  Created: { label: "Held by custodian", tone: "success" },
  Listed: { label: "Waiting for pickup", tone: "warning" },
  PendingHandover: { label: "Waiting for receipt", tone: "warning" },
};

// Custody status from GET /batches/:id/chain.
export default function StatusBadge({ status }) {
  const info = STATUS[status] || { label: status, tone: "neutral" };
  return <Badge tone={info.tone}>{info.label}</Badge>;
}
