import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getBatchChain,
  getTransporterJobs,
  prepareClaim,
  saveClaim,
} from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import { useTxFlow } from "../../../wallet/useTxFlow";
import { RECORD_FIELDS } from "../../../forms/fields";
import { buildRecord, validateRecord } from "../../../forms/record";
import RecordFields from "../../../forms/RecordFields";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import ParticipantName from "../../../components/ParticipantName";
import TxProgress from "../../../components/TxProgress";
import { Loading, ErrorMessage } from "../../../components/State";
import JobSummary from "../JobSummary";
import PendingNotice from "../PendingNotice";
import { CLAIM_KEY, pickupForm } from "../jobs";
import { TEXT } from "../strings";
import "../form.css";

const T = TEXT.claim;
const enc = encodeURIComponent;

// Save takes the same record as prepare; the batch ID moves to the URL.
function saveTransporterClaim(payload, txHash) {
  const { batchId, ...record } = payload;
  return saveClaim(batchId, { txHash, ...record });
}

function keptValues(payload) {
  const record = { ...payload };
  delete record.batchId;
  return record;
}

function Claimed({ batchId, destination }) {
  const D = TEXT.claimed;
  return (
    <Card title={D.title}>
      <p>{D.intro(batchId)}</p>
      <dl className="transporter-form__facts">
        <dt>{D.deliverTo}</dt>
        <dd>
          <ParticipantName address={destination} />
        </dd>
      </dl>
      <div className="transporter-form__links">
        <Link
          to={`/transporter/active/${enc(batchId)}/deliver`}
          className="button button--primary"
        >
          {D.deliverNow}
        </Link>
        <Link to="/transporter/active">{D.myJobs}</Link>
        <Link to="/transporter/jobs">{D.board}</Link>
      </div>
    </Card>
  );
}

export default function ClaimJob() {
  const { batchId } = useParams();
  const jobs = useAsync(getTransporterJobs, "transporter-jobs");
  const chain = useAsync(() => getBatchChain(batchId), `chain:${batchId}`);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const flow = useTxFlow({
    key: CLAIM_KEY,
    prepare: prepareClaim,
    save: saveTransporterClaim,
  });

  const pending = flow.pending;
  const pendingHere = pending && pending.payload.batchId === batchId;
  const job = jobs.data && jobs.data.jobs.find((j) => j.batchId === batchId);

  if (flow.step === "done" && chain.data) {
    return <Claimed batchId={batchId} destination={chain.data.destination} />;
  }

  // Another claim still needs its details saved; that comes first.
  if (pending && !pendingHere) {
    return (
      <Card title={T.title(batchId)}>
        <PendingNotice only={CLAIM_KEY} blocked />
      </Card>
    );
  }

  if ((jobs.loading && !jobs.data) || (chain.loading && !chain.data)) {
    return <Loading text={T.loading} />;
  }
  if (jobs.error || chain.error) {
    return (
      <ErrorMessage
        error={jobs.error || chain.error}
        onRetry={() => {
          jobs.reload();
          chain.reload();
        }}
      />
    );
  }

  if (!job && !pendingHere && !flow.busy) {
    return (
      <Card title={T.title(batchId)}>
        <p>{T.gone}</p>
        <div className="transporter-form__links">
          <Link to="/transporter/jobs">{T.backToBoard}</Link>
          <Link to="/transporter/active">{T.toMyJobs}</Link>
        </div>
      </Card>
    );
  }

  // The stage does not change on a claim, so it is right even after mining.
  const fields = RECORD_FIELDS[pickupForm(chain.data.stage)];
  const formValues = pendingHere ? keptValues(pending.payload) : values;
  const fieldErrors = {
    ...errors,
    ...((flow.error && flow.error.fieldErrors) || {}),
  };
  const locked = flow.busy || Boolean(pending);

  async function submit(event) {
    event.preventDefault();
    const next = validateRecord(fields, formValues);
    setErrors(next);
    if (Object.keys(next).length) return;
    // One payload object for both prepare and save.
    const result = await flow.run({
      batchId,
      ...buildRecord(fields, formValues),
    });
    // A failed claim may mean another transporter took it: check the board.
    if (!result) jobs.reload();
  }

  return (
    <Card title={T.title(batchId)}>
      {job && <JobSummary job={job} />}
      <p className="transporter-form__intro">{T.intro}</p>
      <form onSubmit={submit} noValidate>
        <RecordFields
          fields={fields}
          values={formValues}
          errors={fieldErrors}
          onChange={(name, value) =>
            setValues((v) => ({ ...v, [name]: value }))
          }
          disabled={locked}
        />
        {!pending && (
          <Button type="submit" disabled={locked}>
            {locked ? T.working : T.submit}
          </Button>
        )}
      </form>
      <TxProgress flow={flow} />
    </Card>
  );
}
