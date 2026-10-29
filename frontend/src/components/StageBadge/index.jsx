import Badge from "../Badge";

const STAGE_LABELS = {
  Farm: "Farm",
  Mill: "Olive mill",
  Storage: "Storage",
  Exporter: "Exporter",
  Importer: "Importer",
  Retailer: "Retailer",
};

export default function StageBadge({ stage }) {
  return <Badge>{STAGE_LABELS[stage] || stage}</Badge>;
}
