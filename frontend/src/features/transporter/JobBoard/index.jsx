import { Link } from "react-router-dom";
import { getMyProfile, getTransporterJobs } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import Button from "../../../components/Button";
import RefreshButton from "../../../components/RefreshButton";
import StageBadge from "../../../components/StageBadge";
import { Loading, ErrorMessage, EmptyState } from "../../../components/State";
import JobSummary from "../JobSummary";
import PendingNotice from "../../../components/PendingNotice";
import { CLAIM_KEY, PENDING_KINDS } from "../jobs";
import { TEXT } from "../strings";
import "../../../components/Button/style.css";
import "./style.css";

const T = TEXT.board;
const enc = encodeURIComponent;

function JobCard({ job, unavailable }) {
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
        {unavailable ? (
          <Button disabled>{T.claim}</Button>
        ) : (
          <Link
            to={`/transporter/jobs/${enc(job.batchId)}/claim`}
            className="button button--primary"
          >
            {T.claim}
          </Link>
        )}
      </div>
    </article>
  );
}

export default function JobBoard() {
  const jobs = useAsync(getTransporterJobs, "transporter-jobs");
  // Claiming answers 409 for an unavailable transporter. Saying so here saves
  // filling in the pickup form for nothing. If this fails, the claim still
  // gives the same message.
  const me = useAsync(getMyProfile, "me-profile");
  const unavailable = me.data && me.data.profile.availability === "unavailable";
  const list = jobs.data ? jobs.data.jobs : [];

  return (
    <div className="job-board">
      <div className="job-board__head">
        <h1 className="job-board__title">{T.title}</h1>
        <RefreshButton loading={jobs.loading} onClick={jobs.reload}>
          {TEXT.refresh}
        </RefreshButton>
      </div>
      <p className="job-board__intro">{T.intro}</p>
      <PendingNotice kinds={PENDING_KINDS} only={CLAIM_KEY} blocked />
      {unavailable && (
        <div className="job-board__notice" role="status">
          <span>{T.unavailable}</span>
          <Link to="/settings">{T.toSettings}</Link>
        </div>
      )}

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
                <JobCard key={job.id} job={job} unavailable={unavailable} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
