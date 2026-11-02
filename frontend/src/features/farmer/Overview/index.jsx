import { useState } from "react";
import { Link } from "react-router-dom";
import { getFarmerBatches } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import RefreshButton from "../../../components/RefreshButton";
import Table from "../../../components/Table";
import StageBadge from "../../../components/StageBadge";
import StatusBadge from "../../../components/StatusBadge";
import { STATUS } from "../../../components/StatusBadge/statuses";
import Field from "../../../components/Field";
import ParticipantName from "../../../components/ParticipantName";
import StatTiles from "../../../components/StatTiles";
import ChartGrid from "../../overview/ChartGrid";
import { TEXT as OVERVIEW } from "../../overview/strings";
import { perKey, perMonth } from "../../../utils/stats";
import { Loading, ErrorMessage } from "../../../components/State";
import { formatDay } from "../../../utils/format";
import { TEXT } from "../strings";
import { hasQuantity, oliveTypes, viewBatches } from "./batchList";
import "../../../components/Button/style.css";
import "./style.css";

const T = TEXT.overview;
const F = T.filters;

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

const TYPE_COLUMN = {
  key: "oliveType",
  label: T.columns.oliveType,
  render: (b) => b.olive_type || "",
};

const QUANTITY_COLUMN = {
  key: "quantity",
  label: T.columns.quantity,
  render: (b) => b.quantity ?? "",
};

const BASE_SORTS = ["newest", "oldest", "harvestNewest", "harvestOldest"];
const QUANTITY_SORTS = ["quantityHighest", "quantityLowest"];

export default function FarmerOverview() {
  const list = useAsync(getFarmerBatches, "farmer-batches");
  const [status, setStatus] = useState("");
  const [oliveType, setOliveType] = useState("");
  const [sort, setSort] = useState("newest");
  const batches = list.data ? list.data.batches : [];
  // Olive type and quantity are not in the real route yet, so their controls
  // and columns appear only once the data has them.
  const types = oliveTypes(batches);
  const withQuantity = hasQuantity(batches);
  const sorts = withQuantity ? [...BASE_SORTS, ...QUANTITY_SORTS] : BASE_SORTS;
  // A refresh can remove the chosen type or the quantity sorts.
  const activeType = types.includes(oliveType) ? oliveType : "";
  const activeSort = sorts.includes(sort) ? sort : "newest";
  const filtered = status || activeType;
  const resetFilters = () => {
    setStatus("");
    setOliveType("");
  };
  const shown = viewBatches(batches, {
    status,
    oliveType: activeType,
    sort: activeSort,
  });
  const columns = [
    ...COLUMNS,
    ...(types.length > 0 ? [TYPE_COLUMN] : []),
    ...(withQuantity ? [QUANTITY_COLUMN] : []),
  ];
  // A farm batch keeps stage "Farm" until the mill confirms receipt.
  const atFarm = batches.filter((b) => b.stage === "Farm");
  const waiting = atFarm.filter((b) => b.status === "Listed").length;
  const stats = [
    { label: T.total, value: batches.length },
    { label: T.waiting, value: waiting },
    { label: T.onTheWay, value: atFarm.length - waiting },
    { label: T.atMill, value: batches.length - atFarm.length },
  ];
  const charts = [
    {
      title: OVERVIEW.farmer.perMonth,
      data: perMonth(batches, (b) => b.createdAt),
      unit: OVERVIEW.batchUnit,
    },
    {
      title: OVERVIEW.farmer.perStage,
      data: perKey(
        batches,
        (b) => b.stage,
        Object.keys(OVERVIEW.stages),
        (s) => OVERVIEW.stages[s],
      ),
      unit: OVERVIEW.batchUnit,
      horizontal: true,
    },
  ];

  return (
    <div className="farmer-overview">
      <div className="farmer-overview__head">
        <h1 className="farmer-overview__title">{T.title}</h1>
        <Link to="/farmer/batches/new" className="button button--primary">
          {T.create}
        </Link>
      </div>

      {list.data && <StatTiles items={stats} />}
      {list.data && <ChartGrid charts={charts} />}

      <Card>
        {list.loading && !list.data && <Loading text={T.loading} />}
        <ErrorMessage error={list.error} onRetry={list.reload} />
        {list.data && (
          <>
            {batches.length > 0 && (
              <div className="farmer-overview__filters">
                <Field label={F.status} name="filter-status">
                  <select
                    id="filter-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">{F.allStatuses}</option>
                    {Object.entries(STATUS).map(([value, { label }]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                {types.length > 0 && (
                  <Field label={F.oliveType} name="filter-type">
                    <select
                      id="filter-type"
                      value={activeType}
                      onChange={(e) => setOliveType(e.target.value)}
                    >
                      <option value="">{F.allTypes}</option>
                      {types.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label={F.sort} name="sort-batches">
                  <select
                    id="sort-batches"
                    value={activeSort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    {sorts.map((key) => (
                      <option key={key} value={key}>
                        {F.sorts[key]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
            {batches.length > 0 && (
              <div className="farmer-overview__count-row">
                <p className="farmer-overview__count" aria-live="polite">
                  {F.showing(shown.length, batches.length)}
                </p>
                {filtered && (
                  <Button variant="secondary" onClick={resetFilters}>
                    {F.reset}
                  </Button>
                )}
              </div>
            )}
            <Table
              columns={columns}
              rows={shown.map((b) => ({ ...b, id: b.batchId }))}
              emptyText={batches.length > 0 ? F.noMatch : T.empty}
            />
            <div className="farmer-overview__actions">
              <RefreshButton loading={list.loading} onClick={list.reload}>
                {T.refresh}
              </RefreshButton>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
