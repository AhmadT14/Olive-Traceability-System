import { Link } from "react-router-dom";
import { getMyBatches } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import Table from "../../../components/Table";
import StageBadge from "../../../components/StageBadge";
import StatusBadge from "../../../components/StatusBadge";
import ParticipantName from "../../../components/ParticipantName";
import PendingNotice from "../../../components/PendingNotice";
import { Loading, ErrorMessage } from "../../../components/State";
import { intakePath, labelPath, listPath, PENDING_KINDS } from "../flow";
import { TEXT } from "../strings";
import "../../../components/Button/style.css";
import "./style.css";

const T = TEXT.inbox;
const C = T.columns;

const batchColumn = {
  key: "batchId",
  label: C.batchId,
  render: (b) => (
    <Link to={`/batches/${encodeURIComponent(b.batchId)}`}>{b.batchId}</Link>
  ),
};

const action = (to, text) => (
  <Link to={to} className="button button--primary">
    {text}
  </Link>
);

const AWAITING = [
  batchColumn,
  {
    key: "broughtBy",
    label: C.broughtBy,
    render: (b) => <ParticipantName address={b.custodian} />,
  },
  {
    key: "action",
    label: C.action,
    render: (b) => action(intakePath(b.batchId), T.confirm),
  },
];

const HOLDING = [
  batchColumn,
  {
    key: "stage",
    label: C.stage,
    render: (b) => <StageBadge stage={b.stage} />,
  },
  {
    key: "action",
    label: C.action,
    render: (b) => action(listPath(b.batchId), T.press),
  },
];

const LISTED = [
  batchColumn,
  {
    key: "goingTo",
    label: C.goingTo,
    render: (b) => <ParticipantName address={b.destination} />,
  },
  {
    key: "status",
    label: C.status,
    render: (b) => <StatusBadge status={b.status} />,
  },
  {
    key: "action",
    label: C.action,
    render: (b) => (
      <a href={labelPath(b.batchId)} target="_blank" rel="noreferrer">
        {T.label}
      </a>
    ),
  },
];

const rows = (list) => list.map((b) => ({ ...b, id: b.batchId }));

export default function MillInbox() {
  const mine = useAsync(getMyBatches, "me-batches");
  const data = mine.data;

  const sections = data
    ? [
        [T.awaiting, AWAITING, data.awaitingMyConfirmation, T.awaitingEmpty],
        [T.holding, HOLDING, data.holding, T.holdingEmpty],
        [T.listed, LISTED, data.listedByMe, T.listedEmpty],
      ]
    : [];

  return (
    <div className="mill-inbox">
      <div className="mill-inbox__head">
        <h1 className="mill-inbox__title">{T.title}</h1>
        <Button variant="secondary" onClick={mine.reload}>
          {TEXT.refresh}
        </Button>
      </div>
      <PendingNotice kinds={PENDING_KINDS} />

      {mine.loading && !data && <Loading text={T.loading} />}
      <ErrorMessage error={mine.error} onRetry={mine.reload} />

      {data && (
        <div className="mill-inbox__stats">
          {[
            [data.awaitingMyConfirmation.length, T.stats.awaiting],
            [data.holding.length, T.stats.holding],
            [data.listedByMe.length, T.stats.listed],
          ].map(([n, label]) => (
            <div key={label} className="mill-inbox__stat">
              <span className="mill-inbox__number">{n}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}

      {sections.map(([title, columns, list, empty]) => (
        <Card key={title} title={title}>
          <Table columns={columns} rows={rows(list)} emptyText={empty} />
        </Card>
      ))}
    </div>
  );
}
