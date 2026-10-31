import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getBatchChain, getBatchHistory, prepareReceipt } from "../../../api";
import { useAuth } from "../../../auth/useAuth";
import { useAsync } from "../../../hooks/useAsync";
import { useTxFlow } from "../../../wallet/useTxFlow";
import { RECORD_FIELDS } from "../../../forms/fields";
import { buildRecord, validateRecord } from "../../../forms/record";
import RecordFields from "../../../forms/RecordFields";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import AddressChip from "../../../components/AddressChip";
import ParticipantName from "../../../components/ParticipantName";
import PendingNotice from "../../../components/PendingNotice";
import TxProgress from "../../../components/TxProgress";
import { Loading, ErrorMessage } from "../../../components/State";
import RecordSummary from "../RecordSummary";
import QrPreview from "../QrPreview";
import { FACILITIES } from "../config";
import {
  batchPath,
  inboxPath,
  intakeKey,
  keptValues,
  listPath,
  pendingKinds,
  same,
  tracePath,
  traceUrl,
} from "../flow";
import { TEXT } from "../strings";
import "../../../forms/form-page.css";

const T = TEXT.intake;

function Received({ role, batchId }) {
  const D = TEXT.received;
  const R = TEXT.roles[role];
  return (
    <Card title={D.title}>
      <p>{D.intro(batchId, R.next)}</p>
      <div className="form-page__links">
        <Link to={listPath(role, batchId)} className="button button--primary">
          {R.list}
        </Link>
        <Link to={batchPath(batchId)}>{D.openBatch}</Link>
        <Link to={inboxPath(role)}>{D.toInbox}</Link>
      </div>
    </Card>
  );
}

// The retailer is the last step: show the public page and its QR.
function JourneyEnd({ role, batchId }) {
  const D = TEXT.journeyEnd;
  const url = traceUrl(batchId);
  return (
    <Card title={D.title}>
      <p>{D.intro(batchId)}</p>
      <dl className="form-page__facts">
        <dt>{D.link}</dt>
        <dd>
          <AddressChip address={url} name={url} />
        </dd>
      </dl>
      <QrPreview role={role} batchId={batchId} hint={D.qrHint} />
      <div className="form-page__links">
        <Link to={tracePath(batchId)}>{D.openPublic}</Link>
        <Link to={batchPath(batchId)}>{TEXT.received.openBatch}</Link>
        <Link to={`/${role}/inventory`}>{D.toInventory}</Link>
      </div>
    </Card>
  );
}

// Confirm receipt of a batch a transporter handed over to this facility.
export default function Intake({ role }) {
  const config = FACILITIES[role];
  const FIELDS = RECORD_FIELDS[config.receipt];
  const R = TEXT.roles[role];
  const key = intakeKey(role);
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
    key,
    prepare: prepareReceipt,
    // Save takes the same record as prepare; the batch ID moves to the URL.
    save: (payload, txHash) =>
      config.saveReceipt(payload.batchId, { txHash, ...keptValues(payload) }),
  });

  const pending = flow.pending;
  const pendingHere = pending && pending.payload.batchId === batchId;

  if (flow.step === "done") {
    return config.listing ? (
      <Received role={role} batchId={batchId} />
    ) : (
      <JourneyEnd role={role} batchId={batchId} />
    );
  }

  // Another receipt still needs its details saved; that comes first.
  if (pending && !pendingHere) {
    return (
      <Card title={T.title(batchId)}>
        <PendingNotice kinds={pendingKinds(role)} only={key} blocked />
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
    batch.stage === config.from &&
    same(batch.pendingTarget, session.address);
  if (!waitingForMe && !pendingHere && !flow.busy) {
    const here =
      batch.stage === config.stage && same(batch.custodian, session.address);
    return (
      <Card title={T.title(batchId)}>
        <p>{here ? T.alreadyHere : T.notForYou}</p>
        <div className="form-page__links">
          {here && config.listing && batch.status === "Created" && (
            <Link to={listPath(role, batchId)}>{R.list}</Link>
          )}
          <Link to={inboxPath(role)}>{T.toInbox}</Link>
        </div>
      </Card>
    );
  }

  // The sender's own record (its listing, or the farm record) and the
  // transporter's delivery record, both from the latest handover.
  const events = (history.data && history.data.events) || [];
  const senderEvent = events
    .filter((e) => e.name === "BatchCreated" || e.name === "BatchListed")
    .pop();
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
          <RecordSummary
            title={TEXT.records.sender[config.from]}
            event={senderEvent}
          />
        </>
      )}
      <p className="form-page__intro">{T.intro(R.product, R.unit)}</p>
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
