import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getBatchChain, getBatchDestinations } from "../../../api";
import { useAuth } from "../../../auth/useAuth";
import { useAsync } from "../../../hooks/useAsync";
import { readPendingSave, useTxFlow } from "../../../wallet/useTxFlow";
import { RECORD_FIELDS } from "../../../forms/fields";
import { buildRecord, validateRecord } from "../../../forms/record";
import RecordFields from "../../../forms/RecordFields";
import Card from "../../../components/Card";
import Field from "../../../components/Field";
import Button from "../../../components/Button";
import ParticipantName from "../../../components/ParticipantName";
import PendingNotice from "../../../components/PendingNotice";
import TxProgress from "../../../components/TxProgress";
import { Loading, ErrorMessage } from "../../../components/State";
import { shortAddress } from "../../../utils/format";
import QrPreview from "../QrPreview";
import { FACILITIES } from "../config";
import {
  batchPath,
  inboxPath,
  intakeKey,
  keptValues,
  labelPath,
  listKey,
  pendingKinds,
  same,
  tracePath,
} from "../flow";
import { TEXT } from "../strings";
import "../../../forms/form-page.css";

const T = TEXT.list;

function LabelLink({ role, batchId, className }) {
  return (
    <a
      href={labelPath(role, batchId)}
      target="_blank"
      rel="noreferrer"
      className={className}
    >
      {T.printLabel}
    </a>
  );
}

// Reads the batch again: the save answer does not name the destination.
function Listed({ role, batchId }) {
  const D = TEXT.listed;
  const chain = useAsync(
    () => getBatchChain(batchId),
    `chain-listed:${batchId}`,
  );
  return (
    <Card title={D.title}>
      <p>{D.intro(batchId)}</p>
      <dl className="form-page__facts">
        <dt>{D.goingTo}</dt>
        <dd>
          {chain.data && <ParticipantName address={chain.data.destination} />}
        </dd>
      </dl>
      <div className="form-page__links">
        {FACILITIES[role].qr && (
          <LabelLink
            role={role}
            batchId={batchId}
            className="button button--primary"
          />
        )}
        <Link to={batchPath(batchId)}>{D.openBatch}</Link>
        <Link to={inboxPath(role)}>{D.toInbox}</Link>
      </div>
    </Card>
  );
}

// Record the outgoing details and list the batch for the next role.
export default function ListForPickup({ role }) {
  const config = FACILITIES[role];
  const FIELDS = RECORD_FIELDS[config.listing.fields];
  const R = TEXT.roles[role];
  const key = listKey(role);
  const { batchId } = useParams();
  const { session } = useAuth();
  const chain = useAsync(() => getBatchChain(batchId), `chain:${batchId}`);
  const [picked, setPicked] = useState("");
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const flow = useTxFlow({
    key,
    prepare: config.listing.prepare,
    // Save takes the same record as prepare. The batch ID moves to the URL
    // and the destination is only needed for prepare.
    save: (payload, txHash) =>
      config.listing.save(payload.batchId, {
        txHash,
        ...keptValues(payload, "destinationAddress"),
      }),
  });

  const pending = flow.pending;
  const pendingHere = pending && pending.payload.batchId === batchId;
  const batch = chain.data;
  const ready =
    batch &&
    batch.stage === config.stage &&
    batch.status === "Created" &&
    same(batch.custodian, session.address);
  // The route answers only while the batch can still be listed.
  const targets = useAsync(
    () => getBatchDestinations(batchId),
    ready && !pendingHere ? `destinations:${batchId}` : null,
  );

  if (flow.step === "done") return <Listed role={role} batchId={batchId} />;

  // The receipt details of this batch must be saved before it is listed,
  // or its history keeps a gap.
  const intakePending = readPendingSave(intakeKey(role));
  if (intakePending && intakePending.payload.batchId === batchId) {
    return (
      <Card title={R.listTitle(batchId)}>
        <p>{T.intakeFirst}</p>
        <PendingNotice kinds={pendingKinds(role)} only={intakeKey(role)} />
      </Card>
    );
  }

  // Another listing still needs its details saved; that comes first.
  if (pending && !pendingHere) {
    return (
      <Card title={R.listTitle(batchId)}>
        <PendingNotice kinds={pendingKinds(role)} only={key} blocked />
      </Card>
    );
  }

  if (chain.loading && !batch) return <Loading text={TEXT.loading} />;
  if (chain.error) {
    return <ErrorMessage error={chain.error} onRetry={chain.reload} />;
  }

  if (!ready && !pendingHere && !flow.busy) {
    const listed =
      batch.stage === config.stage &&
      batch.status === "Listed" &&
      same(batch.custodian, session.address);
    return (
      <Card title={R.listTitle(batchId)}>
        <p>{listed ? T.alreadyListed : T.notReady}</p>
        {listed && (
          <dl className="form-page__facts">
            <dt>{TEXT.listed.goingTo}</dt>
            <dd>
              <ParticipantName address={batch.destination} />
            </dd>
          </dl>
        )}
        <div className="form-page__links">
          {listed && config.qr && <LabelLink role={role} batchId={batchId} />}
          <Link to={inboxPath(role)}>{T.toInbox}</Link>
        </div>
      </Card>
    );
  }

  const options = (targets.data && targets.data.destinations) || [];
  const destination = pendingHere
    ? pending.payload.destinationAddress
    : picked || (options[0] && options[0].address) || "";
  // With a QR, the QR code reference starts as the public page path until
  // edited.
  const formValues = pendingHere
    ? keptValues(pending.payload, "destinationAddress")
    : config.qr && values.qr_code_reference === undefined
      ? { ...values, qr_code_reference: tracePath(batchId) }
      : values;
  const fieldErrors = {
    ...errors,
    ...((flow.error && flow.error.fieldErrors) || {}),
  };
  const locked = flow.busy || Boolean(pending);

  async function submit(event) {
    event.preventDefault();
    const next = validateRecord(FIELDS, formValues);
    if (!destination) next.destinationAddress = T.pick;
    setErrors(next);
    if (Object.keys(next).length) return;
    // One payload object for both prepare and save.
    await flow.run({
      batchId,
      destinationAddress: destination,
      ...buildRecord(FIELDS, formValues),
    });
  }

  return (
    <Card title={R.listTitle(batchId)}>
      <p className="form-page__intro">{R.listIntro}</p>
      {config.qr && <QrPreview role={role} batchId={batchId} />}
      <form onSubmit={submit} noValidate>
        {pendingHere ? (
          <dl className="form-page__facts">
            <dt>{R.destination}</dt>
            <dd className="form-page__strong">
              <ParticipantName address={destination} />
            </dd>
          </dl>
        ) : (
          <Field
            label={R.destination}
            name="destinationAddress"
            error={fieldErrors.destinationAddress}
          >
            <select
              id="destinationAddress"
              value={destination}
              onChange={(e) => setPicked(e.target.value)}
              disabled={locked || options.length === 0}
            >
              {options.length === 0 && <option value="">{T.none}</option>}
              {options.map((s) => (
                <option key={s.address} value={s.address}>
                  {s.name || shortAddress(s.address)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {targets.loading && !targets.data && (
          <Loading text={T.loadingOptions} />
        )}
        <ErrorMessage error={targets.error} onRetry={targets.reload} />

        <RecordFields
          fields={FIELDS}
          values={formValues}
          errors={fieldErrors}
          onChange={(name, value) =>
            setValues((v) => ({ ...formValues, ...v, [name]: value }))
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
