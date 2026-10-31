import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  getBatchChain,
  getBatchDestinations,
  prepareMillListing,
  saveMillOutgoing,
} from "../../../api";
import { useAuth } from "../../../auth/useAuth";
import { useAsync } from "../../../hooks/useAsync";
import { useTxFlow } from "../../../wallet/useTxFlow";
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
import {
  keptValues,
  labelPath,
  LIST_KEY,
  PENDING_KINDS,
  same,
  tracePath,
} from "../flow";
import { TEXT } from "../strings";
import "../../../forms/form-page.css";
import "./style.css";

const T = TEXT.list;
const FIELDS = RECORD_FIELDS.mill_outgoing;

// Save takes the same record as prepare. The batch ID moves to the URL and
// the destination is only needed for prepare.
function saveListing(payload, txHash) {
  return saveMillOutgoing(payload.batchId, {
    txHash,
    ...keptValues(payload, "destinationAddress"),
  });
}

// Reads the batch again: the save answer does not name the destination.
function Listed({ batchId }) {
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
        <a
          href={labelPath(batchId)}
          target="_blank"
          rel="noreferrer"
          className="button button--primary"
        >
          {D.printLabel}
        </a>
        <Link to={`/batches/${encodeURIComponent(batchId)}`}>
          {D.openBatch}
        </Link>
        <Link to="/mill/inbox">{D.toInbox}</Link>
      </div>
    </Card>
  );
}

function QrPreview({ batchId }) {
  const url = `${window.location.origin}${tracePath(batchId)}`;
  return (
    <div className="list-oil__qr">
      <QRCodeSVG value={url} size={128} marginSize={2} />
      <div>
        <p className="list-oil__qr-title">{T.qrTitle}</p>
        <p className="form-page__hint">{T.qrHint}</p>
        <a href={labelPath(batchId)} target="_blank" rel="noreferrer">
          {T.printLabel}
        </a>
      </div>
    </div>
  );
}

export default function ListOil() {
  const { batchId } = useParams();
  const { session } = useAuth();
  const chain = useAsync(() => getBatchChain(batchId), `chain:${batchId}`);
  const [storage, setStorage] = useState("");
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const flow = useTxFlow({
    key: LIST_KEY,
    prepare: prepareMillListing,
    save: saveListing,
  });

  const pending = flow.pending;
  const pendingHere = pending && pending.payload.batchId === batchId;
  const batch = chain.data;
  const ready =
    batch &&
    batch.stage === "Mill" &&
    batch.status === "Created" &&
    same(batch.custodian, session.address);
  // The route answers only while the batch can still be listed.
  const storages = useAsync(
    () => getBatchDestinations(batchId),
    ready && !pendingHere ? `destinations:${batchId}` : null,
  );

  if (flow.step === "done") return <Listed batchId={batchId} />;

  // Another listing still needs its details saved; that comes first.
  if (pending && !pendingHere) {
    return (
      <Card title={T.title(batchId)}>
        <PendingNotice kinds={PENDING_KINDS} only={LIST_KEY} blocked />
      </Card>
    );
  }

  if (chain.loading && !batch) return <Loading text={TEXT.loading} />;
  if (chain.error) {
    return <ErrorMessage error={chain.error} onRetry={chain.reload} />;
  }

  if (!ready && !pendingHere && !flow.busy) {
    const listed =
      batch.stage === "Mill" &&
      batch.status === "Listed" &&
      same(batch.custodian, session.address);
    return (
      <Card title={T.title(batchId)}>
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
          {listed && (
            <a href={labelPath(batchId)} target="_blank" rel="noreferrer">
              {T.printLabel}
            </a>
          )}
          <Link to="/mill/inbox">{T.toInbox}</Link>
        </div>
      </Card>
    );
  }

  const options = (storages.data && storages.data.destinations) || [];
  const destination = pendingHere
    ? pending.payload.destinationAddress
    : storage || (options[0] && options[0].address) || "";
  // The QR code reference starts as the public page path until edited.
  const formValues = pendingHere
    ? keptValues(pending.payload, "destinationAddress")
    : values.qr_code_reference === undefined
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
    if (!destination) next.destinationAddress = T.pickStorage;
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
    <Card title={T.title(batchId)}>
      <p className="form-page__intro">{T.intro}</p>
      <QrPreview batchId={batchId} />
      <form onSubmit={submit} noValidate>
        {pendingHere ? (
          <dl className="form-page__facts">
            <dt>{T.storage}</dt>
            <dd className="form-page__strong">
              <ParticipantName address={destination} />
            </dd>
          </dl>
        ) : (
          <Field
            label={T.storage}
            name="destinationAddress"
            error={fieldErrors.destinationAddress}
          >
            <select
              id="destinationAddress"
              value={destination}
              onChange={(e) => setStorage(e.target.value)}
              disabled={locked || options.length === 0}
            >
              {options.length === 0 && <option value="">{T.noStorage}</option>}
              {options.map((s) => (
                <option key={s.address} value={s.address}>
                  {s.name || shortAddress(s.address)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {storages.loading && !storages.data && (
          <Loading text={T.loadingStorage} />
        )}
        <ErrorMessage error={storages.error} onRetry={storages.reload} />

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
