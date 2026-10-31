import { Link } from "react-router-dom";
import { getTransporterJobs } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import Button from "../../../components/Button";
import StageBadge from "../../../components/StageBadge";
import { Loading, ErrorMessage, EmptyState } from "../../../components/State";
import JobSummary from "../JobSummary";
import PendingNotice from "../PendingNotice";
import { CLAIM_KEY } from "../jobs";
import { TEXT } from "../strings";
import "../../../components/Button/style.css";
import "./style.css";

const T = TEXT.board;
const enc = encodeURIComponent;

function JobCard({ job }) {
  return (
    <article className="job-card">
      <header className="job-card__head">
        <Link to={`/batches/${enc(job.batchId)}`} className="job-card__id">
          {job.batchId}
        </Link>
        <StageBadge stage={job.stage} />
      </header>
      <JobSummary job={job} />
      <div className="job-card__actions">
        <Link
          to={`/transporter/jobs/${enc(job.batchId)}/claim`}
          className="button button--primary"
        >
          {T.claim}
        </Link>
      </div>
    </article>
  );
}

export default function JobBoard() {
  const jobs = useAsync(getTransporterJobs, "transporter-jobs");
  const list = jobs.data ? jobs.data.jobs : [];

  return (
    <div className="job-board">
      <div className="job-board__head">
        <h1 className="job-board__title">{T.title}</h1>
        <Button variant="secondary" onClick={jobs.reload}>
          {TEXT.refresh}
        </Button>
      </div>
      <p className="job-board__intro">{T.intro}</p>
      <PendingNotice only={CLAIM_KEY} blocked />

      {jobs.loading && !jobs.data && <Loading text={T.loading} />}
      <ErrorMessage error={jobs.error} onRetry={jobs.reload} />
      {jobs.data && (
        <>
          <p className="job-board__count">{T.count(list.length)}</p>
          {list.length === 0 ? (
            <EmptyState>{T.empty}</EmptyState>
          ) : (
            <div className="job-board__list">
              {list.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
