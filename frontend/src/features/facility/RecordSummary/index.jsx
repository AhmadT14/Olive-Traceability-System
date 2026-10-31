import { describeRecord } from "../../../forms/fields";
import { TEXT } from "../strings";
import "./style.css";

// The saved details of one history event, folded, or a short note when the
// step has no saved details.
export default function RecordSummary({ title, event, open = false }) {
  const rows =
    event && event.details
      ? describeRecord(event.details.type, event.details.values)
      : [];
  return (
    <details className="record-summary" open={open}>
      <summary>{title}</summary>
      {rows.length === 0 ? (
        <p className="record-summary__none">{TEXT.records.none}</p>
      ) : (
        <dl className="record-summary__list">
          {rows.map((r) => (
            <div key={r.name} className="record-summary__row">
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </details>
  );
}
