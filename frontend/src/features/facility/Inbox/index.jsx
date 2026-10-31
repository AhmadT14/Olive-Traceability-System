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
import { FACILITIES } from "../config";
import {
  batchPath,
  intakePath,
  labelPath,
  listPath,
  pendingKinds,
} from "../flow";
import { TEXT } from "../strings";
import "../../../components/Button/style.css";
import "./style.css";

const T = TEXT.inbox;
const C = T.columns;

const batchColumn = {
  key: "batchId",
  label: C.batchId,
  render: (b) => <Link to={batchPath(b.batchId)}>{b.batchId}</Link>,
};

const action = (to, text) => (
  <Link to={to} className="button button--primary">
    {text}
  </Link>
);

function columns(role) {
  const R = TEXT.roles[role];
  const awaiting = [
    batchColumn,
    {
      key: "broughtBy",
      label: C.broughtBy,
      render: (b) => <ParticipantName address={b.custodian} />,
    },
    {
      key: "action",
      label: C.action,
      render: (b) => action(intakePath(role, b.batchId), T.confirm),
    },
  ];
  const holding = [
    batchColumn,
    {
      key: "stage",
      label: C.stage,
      render: (b) => <StageBadge stage={b.stage} />,
    },
    {
      key: "action",
      label: C.action,
      render: (b) => action(listPath(role, b.batchId), R.list),
    },
  ];
  const listed = [
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
  ];
  if (FACILITIES[role].qr) {
    listed.push({
      key: "action",
      label: C.action,
      render: (b) => (
        <a href={labelPath(role, b.batchId)} target="_blank" rel="noreferrer">
          {T.label}
        </a>
      ),
    });
  }
  return { awaiting, holding, listed };
}

const rows = (list) => list.map((b) => ({ ...b, id: b.batchId }));

// The role's inbox: what waits for its confirmation, what it holds and what
// it listed. The retailer lists nothing; its holdings are in Inventory.
export default function FacilityInbox({ role }) {
  const R = TEXT.roles[role];
  const lists = FACILITIES[role].listing;
  const mine = useAsync(getMyBatches, "me-batches");
  const data = mine.data;
  const cols = columns(role);

  const stats = data
    ? [
        [data.awaitingMyConfirmation.length, T.stats.awaiting],
        [data.holding.length, R.holding],
        ...(lists ? [[data.listedByMe.length, T.stats.listed]] : []),
      ]
    : [];
  const sections = data
    ? [
        [
          T.awaiting,
          cols.awaiting,
          data.awaitingMyConfirmation,
          T.awaitingEmpty,
        ],
        ...(lists
          ? [
              [R.holding, cols.holding, data.holding, R.holdingEmpty],
              [T.listed, cols.listed, data.listedByMe, T.listedEmpty],
            ]
          : []),
      ]
    : [];

  return (
    <div className="facility-inbox">
      <div className="facility-inbox__head">
        <h1 className="facility-inbox__title">{R.inbox}</h1>
        <Button variant="secondary" onClick={mine.reload}>
          {TEXT.refresh}
        </Button>
      </div>
      <PendingNotice kinds={pendingKinds(role)} />

      {mine.loading && !data && <Loading text={T.loading} />}
      <ErrorMessage error={mine.error} onRetry={mine.reload} />

      {data && (
        <div className="facility-inbox__stats">
          {stats.map(([n, label]) => (
            <div key={label} className="facility-inbox__stat">
              <span className="facility-inbox__number">{n}</span>
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
      {data && !lists && <Link to={`/${role}/inventory`}>{T.toInventory}</Link>}
    </div>
  );
}
