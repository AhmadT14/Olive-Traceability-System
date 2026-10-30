import { useState } from "react";
import { Link } from "react-router-dom";
import {
  getMillDestinations,
  getMyProfile,
  isBatchIdTaken,
  prepareBatch,
  saveBatch,
} from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import { useTxFlow } from "../../../wallet/useTxFlow";
import { RECORD_FIELDS } from "../../../forms/fields";
import { buildRecord, validateRecord } from "../../../forms/record";
import RecordFields from "../../../forms/RecordFields";
import Card from "../../../components/Card";
import Field from "../../../components/Field";
import Button from "../../../components/Button";
import AddressChip from "../../../components/AddressChip";
import TxProgress from "../../../components/TxProgress";
import { Loading, ErrorMessage } from "../../../components/State";
import { makeBatchId, randomSuffix } from "../../../utils/batchId";
import { shortAddress } from "../../../utils/format";
import { TEXT } from "../strings";
import "./style.css";

const FIELDS = RECORD_FIELDS.farm;
const T = TEXT.create;
const MAX_ID_TRIES = 5;

// The save route takes the same record, minus destinationAddress.
function saveFarmBatch(payload, txHash) {
  const body = { txHash, ...payload };
  delete body.destinationAddress;
  return saveBatch(body);
}

function Created({ batchId, onAnother }) {
  const D = TEXT.done;
  const path = `/trace/${encodeURIComponent(batchId)}`;
  const publicUrl = `${window.location.origin}${path}`;
  return (
    <Card title={D.title}>
      <p>{D.intro}</p>
      <dl className="create-batch__done">
        <dt>{D.batchId}</dt>
        <dd className="create-batch__id">{batchId}</dd>
        <dt>{D.publicLink}</dt>
        <dd>
          <AddressChip address={publicUrl} name={publicUrl} />
        </dd>
      </dl>
      <div className="create-batch__actions">
        <Link to={`/batches/${encodeURIComponent(batchId)}`}>
          {D.openBatch}
        </Link>
        <Link to={path}>{D.publicLink}</Link>
        <Link to="/farmer">{D.overview}</Link>
        <Button variant="secondary" onClick={onAnother}>
          {D.another}
        </Button>
      </div>
    </Card>
  );
}

export default function CreateBatch() {
  const mills = useAsync(getMillDestinations, "mills");
  const profile = useAsync(getMyProfile, "me-profile");
  const [suffix, setSuffix] = useState(randomSuffix);
  const [mill, setMill] = useState("");
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(null);
  const flow = useTxFlow({
    key: "farmer-create-batch",
    prepare: prepareBatch,
    save: saveFarmBatch,
  });

  // A save waiting for retry shows the kept values: they are what gets saved.
  const pendingPayload = flow.pending ? flow.pending.payload : null;
  const keptRecord = pendingPayload
    ? Object.fromEntries(
        Object.entries(pendingPayload).filter(
          ([name]) => name !== "batchId" && name !== "destinationAddress",
        ),
      )
    : null;

  // Location starts as the farm profile location until the farmer edits it.
  const profileLocation =
    (profile.data && profile.data.profile.location) || undefined;
  const formValues =
    keptRecord ||
    (values.location === undefined && profileLocation
      ? { ...values, location: profileLocation }
      : values);

  const idFor = (s) =>
    makeBatchId({
      location: formValues.location,
      harvestDate: formValues.harvest_date,
      suffix: s,
    });
  const batchId = pendingPayload ? pendingPayload.batchId : idFor(suffix);

  const millOptions = (mills.data && mills.data.destinations) || [];
  const destination =
    (pendingPayload && pendingPayload.destinationAddress) ||
    mill ||
    (millOptions[0] && millOptions[0].address) ||
    "";
  const fieldErrors = {
    ...errors,
    ...((flow.error && flow.error.fieldErrors) || {}),
  };

  // Tries new random parts until the chain has no batch with that ID.
  async function freeBatchId() {
    let s = suffix;
    for (let i = 0; i < MAX_ID_TRIES; i += 1) {
      if (!(await isBatchIdTaken(idFor(s)))) {
        setSuffix(s);
        return idFor(s);
      }
      s = randomSuffix();
    }
    throw new Error(T.idFailed);
  }

  async function submit(event) {
    event.preventDefault();
    const next = validateRecord(FIELDS, formValues);
    if (!destination) next.destinationAddress = T.pickMill;
    setErrors(next);
    if (Object.keys(next).length) return;

    setCheckError(null);
    setChecking(true);
    let id;
    try {
      id = await freeBatchId();
    } catch (err) {
      setCheckError(err);
      return;
    } finally {
      setChecking(false);
    }

    // One payload object for both prepare and save.
    await flow.run({
      batchId: id,
      destinationAddress: destination,
      ...buildRecord(FIELDS, formValues),
    });
  }

  function startAnother() {
    flow.reset();
    setValues({});
    setErrors({});
    setMill("");
    setSuffix(randomSuffix());
  }

  if (flow.step === "done" && flow.result) {
    return (
      <Created batchId={flow.result.batchId} onAnother={startAnother} />
    );
  }

  const locked = checking || flow.busy || Boolean(flow.pending);

  return (
    <Card title={T.title}>
      <p>{T.intro}</p>
      <form onSubmit={submit} noValidate>
        <Field label={T.batchId} name="batchId" hint={T.batchIdHint}>
          <input id="batchId" value={batchId} readOnly />
        </Field>
        <Field
          label={T.mill}
          name="destinationAddress"
          error={fieldErrors.destinationAddress}
        >
          <select
            id="destinationAddress"
            value={destination}
            onChange={(e) => setMill(e.target.value)}
            disabled={locked || millOptions.length === 0}
          >
            {millOptions.length === 0 && (
              <option value="">{T.noMills}</option>
            )}
            {millOptions.map((m) => (
              <option key={m.address} value={m.address}>
                {m.name || shortAddress(m.address)}
              </option>
            ))}
          </select>
        </Field>
        {mills.loading && <Loading text={T.loadingMills} />}
        <ErrorMessage error={mills.error} onRetry={mills.reload} />

        <RecordFields
          fields={FIELDS}
          values={formValues}
          errors={fieldErrors}
          onChange={(name, value) =>
            setValues((v) => ({ ...formValues, ...v, [name]: value }))
          }
          disabled={locked}
        />

        {checking && <Loading text={T.checking} />}
        <ErrorMessage error={checkError} />

        {!flow.pending && (
          <Button type="submit" disabled={locked}>
            {locked ? T.working : T.submit}
          </Button>
        )}
      </form>

      <TxProgress flow={flow} />
    </Card>
  );
}
