import Badge from "../Badge";

// Overall statuses and per event statuses from GET /batches/:id/verify.
const INTEGRITY = {
  verified: { label: "Verified on chain", tone: "success" },
  mismatch: { label: "Mismatch found", tone: "danger" },
  incomplete: { label: "Not fully verified", tone: "warning" },
  hash_mismatch: { label: "Details changed", tone: "danger" },
  metadata_mismatch: { label: "Wrong event type", tone: "danger" },
  event_not_found_on_chain: { label: "Not found on chain", tone: "danger" },
  unverifiable: { label: "Cannot be verified", tone: "neutral" },
};

export default function IntegrityBadge({ status }) {
  const info = INTEGRITY[status] || { label: status, tone: "neutral" };
  return <Badge tone={info.tone}>{info.label}</Badge>;
}
