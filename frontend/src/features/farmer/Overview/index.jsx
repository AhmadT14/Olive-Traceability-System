import { Link } from "react-router-dom";
import { getFarmerBatches } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import Table from "../../../components/Table";
import StageBadge from "../../../components/StageBadge";
import StatusBadge from "../../../components/StatusBadge";
import ParticipantName from "../../../components/ParticipantName";
import { Loading, ErrorMessage } from "../../../components/State";
import { formatDay } from "../../../utils/format";
import { TEXT } from "../strings";
import "../../../components/Button/style.css";
import "./style.css";

const T = TEXT.overview;

const COLUMNS = [
  {
    key: "batchId",
    label: T.columns.batchId,
    render: (b) => (
      <Link to={`/batches/${encodeURIComponent(b.batchId)}`}>{b.batchId}</Link>
    ),
  },
  {
    key: "harvest",
    label: T.columns.harvest,
    render: (b) => formatDay(b.harvestDate),
  },
  {
    key: "stage",
    label: T.columns.stage,
    render: (b) => <StageBadge stage={b.stage} />,
  },
  {
    key: "status",
    label: T.columns.status,
    render: (b) => <StatusBadge status={b.status} />,
  },
  {
    key: "heldBy",
    label: T.columns.heldBy,
    render: (b) => <ParticipantName address={b.custodian} />,
  },
];

export default function FarmerOverview() {
  const list = useAsync(getFarmerBatches, "farmer-batches");
  const batches = list.data ? list.data.batches : [];
  // Only batches still at the farm: the ones the farmer is waiting on.
  const waiting = batches.filter(
    (b) => b.stage === "Farm" && b.status === "Listed",
  ).length;

  return (
    <div className="farmer-overview">
      <div className="farmer-overview__head">
        <h1 className="farmer-overview__title">{T.title}</h1>
        <Link to="/farmer/batches/new" className="button button--primary">
          {T.create}
        </Link>
      </div>

      {list.data && (
        <div className="farmer-overview__stats">
          <div className="farmer-overview__stat">
            <span className="farmer-overview__number">{batches.length}</span>
            <span>{T.total}</span>
          </div>
          <div className="farmer-overview__stat">
            <span className="farmer-overview__number">{waiting}</span>
            <span>{T.waiting}</span>
          </div>
        </div>
      )}

      <Card>
        {list.loading && !list.data && <Loading text={T.loading} />}
        <ErrorMessage error={list.error} onRetry={list.reload} />
        {list.data && (
          <>
            <Table
              columns={COLUMNS}
              rows={batches.map((b) => ({ ...b, id: b.batchId }))}
              emptyText={T.empty}
            />
            <div className="farmer-overview__actions">
              <Button variant="secondary" onClick={list.reload}>
                {T.refresh}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
