import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getBatchChain,
  getBatchHistory,
  prepareReceipt,
  saveMillIntake,
} from "../../../api";
import { useAuth } from "../../../auth/useAuth";
import { useAsync } from "../../../hooks/useAsync";
import { useTxFlow } from "../../../wallet/useTxFlow";
import { RECORD_FIELDS } from "../../../forms/fields";
import { buildRecord, validateRecord } from "../../../forms/record";
import RecordFields from "../../../forms/RecordFields";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import ParticipantName from "../../../components/ParticipantName";
import PendingNotice from "../../../components/PendingNotice";
import TxProgress from "../../../components/TxProgress";
import { Loading, ErrorMessage } from "../../../components/State";
import RecordSummary from "../RecordSummary";
import { INTAKE_KEY, keptValues, listPath, PENDING_KINDS, same } from "../flow";
import { TEXT } from "../strings";
import "../../../forms/form-page.css";

const T = TEXT.intake;
const FIELDS = RECORD_FIELDS.mill_receipt;

// Save takes the same record as prepare; the batch ID moves to the URL.
function saveIntake(payload, txHash) {
  return saveMillIntake(payload.batchId, {
    txHash,
    ...keptValues(payload),
  });
}

function Received({ batchId }) {
  const D = TEXT.received;
  return (
    <Card title={D.title}>
      <p>{D.intro(batchId)}</p>
      <div className="form-page__links">
        <Link to={listPath(batchId)} className="button button--primary">
          {D.toList}
        </Link>
        <Link to={`/batches/${encodeURIComponent(batchId)}`}>
          {D.openBatch}
        </Link>
        <Link to="/mill/inbox">{D.toInbox}</Link>
      </div>
    </Card>
  );
}

export default function MillIntake() {
  const { batchId } = useParams();
  const { session } = useAuth();
  const chain = useAsync(() => getBatchChain(batchId), `chain:${batchId}`);
  const history = useAsync(
    () => getBatchHistory(batchId),
    `history:${batchId}`,
  );
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const flow = useTxFlow({
    key: INTAKE_KEY,
    prepare: prepareReceipt,
    save: saveIntake,
  });

  const pending = flow.pending;
  const pendingHere = pending && pending.payload.batchId === batchId;

  if (flow.step === "done") return <Received batchId={batchId} />;

  // Another receipt still needs its details saved; that comes first.
  if (pending && !pendingHere) {
    return (
      <Card title={T.title(batchId)}>
        <PendingNotice kinds={PENDING_KINDS} only={INTAKE_KEY} blocked />
      </Card>
    );
  }

  if (chain.loading && !chain.data) return <Loading text={TEXT.loading} />;
  if (chain.error) {
    return <ErrorMessage error={chain.error} onRetry={chain.reload} />;
  }

  const batch = chain.data;
  const waitingForMe =
    batch.status === "PendingHandover" &&
    batch.stage === "Farm" &&
    same(batch.pendingTarget, session.address);
  if (!waitingForMe && !pendingHere && !flow.busy) {
    const here =
      batch.stage === "Mill" && same(batch.custodian, session.address);
    return (
      <Card title={T.title(batchId)}>
        <p>{here ? T.alreadyHere : T.notForYou}</p>
        <div className="form-page__links">
          {here && batch.status === "Created" && (
            <Link to={listPath(batchId)}>{T.toList}</Link>
          )}
          <Link to="/mill/inbox">{T.toInbox}</Link>
        </div>
      </Card>
    );
  }

  const events = (history.data && history.data.events) || [];
  const farmEvent = events.find((e) => e.name === "BatchCreated");
  const deliveryEvent = events
    .filter((e) => e.name === "HandoverInitiated")
    .pop();

  const formValues = pendingHere ? keptValues(pending.payload) : values;
  const fieldErrors = {
    ...errors,
    ...((flow.error && flow.error.fieldErrors) || {}),
  };
  const locked = flow.busy || Boolean(pending);

  async function submit(event) {
    event.preventDefault();
    const next = validateRecord(FIELDS, formValues);
    setErrors(next);
    if (Object.keys(next).length) return;
    // One payload object for both prepare and save.
    await flow.run({ batchId, ...buildRecord(FIELDS, formValues) });
  }

  return (
    <Card title={T.title(batchId)}>
      <dl className="form-page__facts">
        <dt>{T.broughtBy}</dt>
        <dd>
          <ParticipantName address={batch.custodian} />
        </dd>
      </dl>
      {history.loading && !history.data && <Loading text={TEXT.loading} />}
      <ErrorMessage error={history.error} onRetry={history.reload} />
      {history.data && (
        <>
          <RecordSummary
            title={TEXT.records.delivery}
            event={deliveryEvent}
            open
          />
          <RecordSummary title={TEXT.records.farm} event={farmEvent} />
        </>
      )}
      <p className="form-page__intro">{T.intro}</p>
      <form onSubmit={submit} noValidate>
        <RecordFields
          fields={FIELDS}
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
