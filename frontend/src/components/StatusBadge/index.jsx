import Badge from "../Badge";
import { STATUS } from "./statuses";

export default function StatusBadge({ status }) {
  const info = STATUS[status] || { label: status, tone: "neutral" };
  return <Badge tone={info.tone}>{info.label}</Badge>;
}
