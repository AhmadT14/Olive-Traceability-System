import { Link } from "react-router-dom";
import {
  getCompletedTransporterJobs,
  getMyTransporterJobs,
} from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import Card from "../../../components/Card";
import Badge from "../../../components/Badge";
import Button from "../../../components/Button";
import Table from "../../../components/Table";
import { Loading, ErrorMessage } from "../../../components/State";
import { formatDay } from "../../../utils/format";
import PendingNotice from "../PendingNotice";
import { partyName, productLabel } from "../jobs";
import { TEXT } from "../strings";
import "../../../components/Button/style.css";
import "./style.css";

const T = TEXT.myJobs;
const C = T.columns;
const enc = encodeURIComponent;

const STATUS_TONE = {
  claimed: "warning",
  handover_pending: "warning",
  completed: "success",
};

const batchColumn = {
  key: "batchId",
  label: C.batchId,
  render: (j) => <Link to={`/batches/${enc(j.batchId)}`}>{j.batchId}</Link>,
};
const routeColumns = [
  { key: "product", label: C.product, render: (j) => productLabel(j.stage) },
  { key: "from", label: C.from, render: (j) => partyName(j.source) },
  { key: "to", label: C.to, render: (j) => partyName(j.destination) },
];
const statusColumn = {
  key: "status",
  label: C.status,
  render: (j) => (
    <Badge tone={STATUS_TONE[j.status] || "neutral"}>
      {TEXT.status[j.status] || j.status}
    </Badge>
  ),
};

const ACTIVE_COLUMNS = [
  batchColumn,
  ...routeColumns,
  statusColumn,
  {
    key: "action",
    label: C.action,
    render: (j) =>
      j.status === "claimed" && (
        <Link
          to={`/transporter/active/${enc(j.batchId)}/deliver`}
          className="button button--primary"
        >
          {T.deliver}
        </Link>
      ),
  },
];

const COMPLETED_COLUMNS = [
  batchColumn,
  ...routeColumns,
  { key: "listed", label: C.listed, render: (j) => formatDay(j.createdAt) },
];

export default function MyJobs() {
  const active = useAsync(getMyTransporterJobs, "transporter-my-jobs");
  const done = useAsync(getCompletedTransporterJobs, "transporter-done-jobs");

  function reload() {
    active.reload();
    done.reload();
  }

  return (
    <div className="my-jobs">
      <div className="my-jobs__head">
        <h1 className="my-jobs__title">{T.title}</h1>
        <Button variant="secondary" onClick={reload}>
          {TEXT.refresh}
        </Button>
      </div>
      <PendingNotice />

      <Card title={T.active}>
        {active.loading && !active.data && <Loading text={T.loading} />}
        <ErrorMessage error={active.error} onRetry={active.reload} />
        {active.data && (
          <Table
            columns={ACTIVE_COLUMNS}
            rows={active.data.jobs}
            emptyText={T.activeEmpty}
          />
        )}
      </Card>

      <Card title={T.completed}>
        {done.loading && !done.data && <Loading text={T.loading} />}
        <ErrorMessage error={done.error} onRetry={done.reload} />
        {done.data &&
          (done.data.available ? (
            <Table
              columns={COMPLETED_COLUMNS}
              rows={done.data.jobs}
              emptyText={T.completedEmpty}
            />
          ) : (
            <p className="my-jobs__note">{T.completedMissing}</p>
          ))}
      </Card>
    </div>
  );
}
