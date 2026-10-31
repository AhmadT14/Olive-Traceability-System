import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getBatchChain,
  getMyTransporterJobs,
  prepareHandover,
  saveHandover,
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
import { DELIVER_KEY, deliveryForm, partyName } from "../jobs";
import { TEXT } from "../strings";
import "../form.css";

const T = TEXT.deliver;
const enc = encodeURIComponent;

// Save takes the same record as prepare. The batch ID moves to the URL and
// the target is only needed for prepare.
function saveTransporterHandover(payload, txHash) {
  const record = { ...payload };
  delete record.batchId;
  delete record.targetAddress;
  return saveHandover(payload.batchId, { txHash, ...record });
}

function keptValues(payload) {
  const record = { ...payload };
  delete record.batchId;
  delete record.targetAddress;
  return record;
}

function Delivered({ batchId, target }) {
  const D = TEXT.delivered;
  return (
    <Card title={D.title}>
      <p>{D.intro(batchId)}</p>
      <dl className="transporter-form__facts">
        <dt>{D.receiver}</dt>
        <dd>
          <ParticipantName address={target} />
        </dd>
      </dl>
      <div className="transporter-form__links">
        <Link to={`/batches/${enc(batchId)}`}>{D.openBatch}</Link>
        <Link to="/transporter/active">{D.myJobs}</Link>
        <Link to="/transporter/jobs">{D.board}</Link>
      </div>
    </Card>
  );
}

export default function DeliverJob() {
  const { batchId } = useParams();
  const mine = useAsync(getMyTransporterJobs, "transporter-my-jobs");
  const chain = useAsync(() => getBatchChain(batchId), `chain:${batchId}`);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const flow = useTxFlow({
    key: DELIVER_KEY,
    prepare: prepareHandover,
    save: saveTransporterHandover,
  });

  const pending = flow.pending;
  const pendingHere = pending && pending.payload.batchId === batchId;
  const job = mine.data && mine.data.jobs.find((j) => j.batchId === batchId);

  if (flow.step === "done" && flow.result) {
    return <Delivered batchId={batchId} target={flow.result.targetAddress} />;
  }

  // Another delivery still needs its details saved; that comes first.
  if (pending && !pendingHere) {
    return (
      <Card title={T.title(batchId)}>
        <PendingNotice only={DELIVER_KEY} blocked />
      </Card>
    );
  }

  if ((mine.loading && !mine.data) || (chain.loading && !chain.data)) {
    return <Loading text={T.loading} />;
  }
  if (mine.error || chain.error) {
    return (
      <ErrorMessage
        error={mine.error || chain.error}
        onRetry={() => {
          mine.reload();
          chain.reload();
        }}
      />
    );
  }

  const back = (
    <div className="transporter-form__links">
      <Link to="/transporter/active">{T.myJobs}</Link>
    </div>
  );
  if (!pendingHere && !flow.busy) {
    if (!job) {
      return (
        <Card title={T.title(batchId)}>
          <p>{T.notMine}</p>
          {back}
        </Card>
      );
    }
    if (job.status === "handover_pending") {
      return (
        <Card title={T.title(batchId)}>
          <p>{T.alreadyHanded(partyName(job.destination))}</p>
          {back}
        </Card>
      );
    }
  }

  // The target is the job destination, never a free choice.
  const target = pendingHere
    ? pending.payload.targetAddress
    : job.destination.address;
  const fields = RECORD_FIELDS[deliveryForm(chain.data.stage)];
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
    await flow.run({
      batchId,
      targetAddress: target,
      ...buildRecord(fields, formValues),
    });
  }

  return (
    <Card title={T.title(batchId)}>
      {job && <JobSummary job={job} />}
      <p className="transporter-form__intro">{T.intro}</p>
      <form onSubmit={submit} noValidate>
        <dl className="transporter-form__facts">
          <dt>{T.destination}</dt>
          <dd>
            <span className="transporter-form__strong">
              <ParticipantName address={target} />
            </span>
            <span className="transporter-form__hint">{T.destinationHint}</span>
          </dd>
        </dl>
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
