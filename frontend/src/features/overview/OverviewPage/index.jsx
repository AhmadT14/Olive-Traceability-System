import { Link } from "react-router-dom";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import StatTiles from "../../../components/StatTiles";
import { Loading, ErrorMessage } from "../../../components/State";
import ChartGrid from "../ChartGrid";
import { TEXT } from "../strings";
import "./style.css";

// Shared layout of the role Overview pages: title, key numbers, charts,
// links. `stats` and `charts` are null until the data is loaded.
export default function OverviewPage({
  title,
  load,
  stats,
  charts,
  note,
  links,
  children,
}) {
  return (
    <div className="overview">
      <div className="overview__head">
        <h1 className="overview__title">{title}</h1>
        <Button variant="secondary" onClick={load.reload}>
          {TEXT.refresh}
        </Button>
      </div>

      {load.loading && !load.data && <Loading text={TEXT.loading} />}
      <ErrorMessage error={load.error} onRetry={load.reload} />
      {stats && <StatTiles items={stats} missing={TEXT.missing} />}
      {stats && note && <p className="overview__note">{note}</p>}
      {children}
      {charts && <ChartGrid charts={charts} />}

      {links && (
        <Card title={TEXT.linksTitle}>
          <ul className="overview__links">
            {links.map((link) => (
              <li key={link.to}>
                <Link to={link.to}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
