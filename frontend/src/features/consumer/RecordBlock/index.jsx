import { describeRecord } from "../../../forms/fields";
import { TEXT } from "../strings";
import "./style.css";

const TONE = {
  verified: "good",
  hash_mismatch: "bad",
  metadata_mismatch: "bad",
  event_not_found_on_chain: "bad",
};

// One saved record (a history event) with its check result.
export default function RecordBlock({ event, integrity }) {
  const heading = TEXT.trace.records[event.name] || event.name;
  const status = integrity && integrity.get(event.txHash.toLowerCase());

  if (!event.details) {
    return (
      <div className="record">
        <h4 className="record__heading">{heading}</h4>
        <p className="record__empty">{TEXT.trace.noDetails}</p>
      </div>
    );
  }

  const rows = describeRecord(event.details.type, event.details.values || {});
  return (
    <div className="record">
      <h4 className="record__heading">
        {heading}
        {status && (
          <span
            className={`record__check record__check--${TONE[status] || "neutral"}`}
          >
            {TEXT.integrity.status[status] || status}
          </span>
        )}
      </h4>
      <dl className="record__list">
        {rows.map((row) => (
          <div key={row.name} className="record__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
