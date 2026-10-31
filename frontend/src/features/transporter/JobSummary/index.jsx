import { formatDay } from "../../../utils/format";
import { outgoingRows, partyName, productLabel } from "../jobs";
import { TEXT } from "../strings";
import "./style.css";

const T = TEXT.job;

// Product, route and the sender's outgoing record for one job.
export default function JobSummary({ job }) {
  const rows = outgoingRows(job.outgoingDetails);
  return (
    <div className="job-summary">
      <dl className="job-summary__facts">
        <dt>{T.product}</dt>
        <dd>{productLabel(job.stage)}</dd>
        <dt>{T.from}</dt>
        <dd>{partyName(job.source)}</dd>
        <dt>{T.to}</dt>
        <dd className="job-summary__strong">{partyName(job.destination)}</dd>
        {job.createdAt && (
          <>
            <dt>{T.listed}</dt>
            <dd>{formatDay(job.createdAt)}</dd>
          </>
        )}
      </dl>
      {rows.length > 0 ? (
        <details className="job-summary__details">
          <summary>{T.senderNotes}</summary>
          <dl className="job-summary__facts">
            {rows.map((r) => (
              <div key={r.key} className="job-summary__row">
                <dt>{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : (
        <p className="job-summary__none">{T.noSenderNotes}</p>
      )}
    </div>
  );
}
