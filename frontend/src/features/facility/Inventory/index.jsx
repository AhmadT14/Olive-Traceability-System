import { Link } from "react-router-dom";
import { getMyBatches } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import Card from "../../../components/Card";
import RefreshButton from "../../../components/RefreshButton";
import Table from "../../../components/Table";
import { Loading, ErrorMessage } from "../../../components/State";
import { batchPath, labelPath, tracePath } from "../flow";
import { TEXT } from "../strings";
import "../Inbox/style.css";

const T = TEXT.inventory;
const C = T.columns;
const ROLE = "retailer";

const COLUMNS = [
  {
    key: "batchId",
    label: C.batchId,
    render: (b) => <Link to={batchPath(b.batchId)}>{b.batchId}</Link>,
  },
  {
    key: "page",
    label: C.page,
    render: (b) => <Link to={tracePath(b.batchId)}>{T.publicPage}</Link>,
  },
  {
    key: "label",
    label: C.label,
    render: (b) => (
      <a href={labelPath(ROLE, b.batchId)} target="_blank" rel="noreferrer">
        {T.label}
      </a>
    ),
  },
];

// The retailer's batches: everything it confirmed and still holds.
export default function Inventory() {
  const mine = useAsync(getMyBatches, "me-batches");
  const R = TEXT.roles[ROLE];
  const list = mine.data ? mine.data.holding : [];

  return (
    <div className="facility-inbox">
      <div className="facility-inbox__head">
        <h1 className="facility-inbox__title">{T.title}</h1>
        <RefreshButton loading={mine.loading} onClick={mine.reload}>
          {TEXT.refresh}
        </RefreshButton>
      </div>
      <p>{T.intro}</p>
      {mine.loading && !mine.data && <Loading text={TEXT.inbox.loading} />}
      <ErrorMessage error={mine.error} onRetry={mine.reload} />
      {mine.data && (
        <Card title={`${R.holding} (${list.length})`}>
          <Table
            columns={COLUMNS}
            rows={list.map((b) => ({ ...b, id: b.batchId }))}
            emptyText={R.holdingEmpty}
          />
        </Card>
      )}
    </div>
  );
}
