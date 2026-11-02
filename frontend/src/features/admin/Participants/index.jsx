import { useState } from "react";
import { Link } from "react-router-dom";
import { getAdminParticipants } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import { roleLabel } from "../../../auth/roles";
import Card from "../../../components/Card";
import RefreshButton from "../../../components/RefreshButton";
import Badge from "../../../components/Badge";
import Field from "../../../components/Field";
import Table from "../../../components/Table";
import { Loading, ErrorMessage } from "../../../components/State";
import { shortAddress } from "../../../utils/format";
import { TEXT } from "../strings";
import "../../../components/Button/style.css";
import "./style.css";

const T = TEXT.directory;
const C = T.columns;

const withAddress = (path, address) =>
  `${path}?address=${encodeURIComponent(address)}`;

const COLUMNS = [
  {
    key: "name",
    label: C.name,
    render: (p) => (
      <span className="participants__who" title={p.address}>
        <span className="participants__name">{p.name || T.noName}</span>
        <span className="participants__wallet">{shortAddress(p.address)}</span>
      </span>
    ),
  },
  { key: "location", label: C.location, render: (p) => p.location || "" },
  {
    key: "roles",
    label: C.roles,
    render: (p) =>
      p.roles.length ? (
        <span className="participants__roles">
          {p.roles.map((r) => (
            <Badge key={r} tone="success">
              {roleLabel(r)}
            </Badge>
          ))}
        </span>
      ) : (
        <Badge>{T.noRoles}</Badge>
      ),
  },
  {
    key: "availability",
    label: C.availability,
    render: (p) =>
      p.availability === "unavailable" ? (
        <Badge tone="warning">{T.unavailable}</Badge>
      ) : (
        T.available
      ),
  },
  {
    key: "actions",
    label: C.actions,
    render: (p) => (
      <span className="participants__actions">
        <Link to={withAddress("/admin/participants/new", p.address)}>
          {T.addRole}
        </Link>
        {p.roles.length > 0 && (
          <Link to={withAddress("/admin/participants/revoke", p.address)}>
            {T.revoke}
          </Link>
        )}
      </span>
    ),
  },
];

function matches(p, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [p.name, p.location, p.address].some((v) =>
    String(v || "")
      .toLowerCase()
      .includes(q),
  );
}

// The admin's participant directory from GET /admin/participants.
export default function Participants() {
  const list = useAsync(getAdminParticipants, "admin-participants");
  const [query, setQuery] = useState("");
  const all = (list.data && list.data.participants) || [];
  const rows = all
    .filter((p) => matches(p, query))
    .map((p) => ({ ...p, id: p.address }));

  return (
    <Card page title={T.title}>
      <p className="participants__intro">{T.intro}</p>
      <div className="participants__bar">
        <Field label={T.search} name="participant-search" hint={T.searchHint}>
          <input
            id="participant-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </Field>
        <div className="participants__buttons">
          <RefreshButton loading={list.loading} onClick={list.reload}>
            {T.refresh}
          </RefreshButton>
          <Link to="/admin/participants/new" className="button button--primary">
            {T.register}
          </Link>
        </div>
      </div>

      {list.loading && !list.data && <Loading text={T.loading} />}
      <ErrorMessage error={list.error} onRetry={list.reload} />
      {list.data && (
        <Table
          columns={COLUMNS}
          rows={rows}
          emptyText={all.length ? T.noMatch : T.empty}
        />
      )}
    </Card>
  );
}
