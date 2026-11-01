import { Link } from "react-router-dom";
import "./style.css";

// A row of key numbers. Each item is { label, value, to? }; `to` links the
// tile to the page that lists those items. A null value shows `missing`.
export default function StatTiles({ items, missing = "Not available" }) {
  return (
    <ul className="stat-tiles">
      {items.map((item) => {
        const known = item.value !== null && item.value !== undefined;
        const body = (
          <>
            <span
              className={
                known ? "stat-tiles__number" : "stat-tiles__number--missing"
              }
            >
              {known ? item.value : missing}
            </span>
            <span>{item.label}</span>
          </>
        );
        return (
          <li key={item.label} className="stat-tiles__item">
            {item.to ? (
              <Link to={item.to} className="stat-tiles__tile">
                {body}
              </Link>
            ) : (
              <div className="stat-tiles__tile">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
