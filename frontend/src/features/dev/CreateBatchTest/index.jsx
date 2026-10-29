import { useState } from "react";
import { Link } from "react-router-dom";
import { getMillDestinations, prepareBatch, saveBatch } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import { useTxFlow } from "../../../wallet/useTxFlow";
import { RECORD_FIELDS } from "../../../forms/fields";
import { buildRecord, validateRecord } from "../../../forms/record";
import RecordFields from "../../../forms/RecordFields";
import Card from "../../../components/Card";
import Field from "../../../components/Field";
import Button from "../../../components/Button";
import TxProgress from "../../../components/TxProgress";
import { Loading, ErrorMessage } from "../../../components/State";
import { shortAddress } from "../../../utils/format";

const FIELDS = RECORD_FIELDS.farm;

// The save route takes the same record, minus destinationAddress.
function saveFarmBatch(payload, txHash) {
  const body = { txHash, ...payload };
  delete body.destinationAddress;
  return saveBatch(body);
}

// Temporary Phase 2 page: runs create batch through useTxFlow end to end.
// Phase 4 replaces it with the real farmer form.
export default function CreateBatchTest() {
  const mills = useAsync(getMillDestinations, "mills");
  const [batchId, setBatchId] = useState("B2");
  const [mill, setMill] = useState("");
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const flow = useTxFlow({
    key: "dev-create-batch",
    prepare: prepareBatch,
    save: saveFarmBatch,
  });

  const millOptions = (mills.data && mills.data.destinations) || [];
  const destination = mill || (millOptions[0] && millOptions[0].address) || "";
  const fieldErrors = {
    ...errors,
    ...((flow.error && flow.error.fieldErrors) || {}),
  };

  async function submit(event) {
    event.preventDefault();
    const next = validateRecord(FIELDS, values);
    const id = batchId.trim();
    if (!id) next.batchId = "Enter a batch ID.";
    else if (id.length > 64)
      next.batchId = "A batch ID has at most 64 characters.";
    if (!destination) next.destinationAddress = "Pick a mill.";
    setErrors(next);
    if (Object.keys(next).length) return;

    // One payload object for both prepare and save.
    await flow.run({
      batchId: id,
      destinationAddress: destination,
      ...buildRecord(FIELDS, values),
    });
  }

  const locked = flow.busy || Boolean(flow.pending) || flow.step === "done";

  return (
    <Card title="Test: create a batch">
      <p>
        Temporary page for checking the transaction flow. Fields marked * are
        required.
      </p>
      <form onSubmit={submit} noValidate>
        <Field label="Batch ID *" name="batchId" error={fieldErrors.batchId}>
          <input
            id="batchId"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            disabled={locked}
          />
        </Field>
        <Field
          label="Destination mill *"
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
              <option value="">No mills found</option>
            )}
            {millOptions.map((m) => (
              <option key={m.address} value={m.address}>
                {m.name || shortAddress(m.address)}
              </option>
            ))}
          </select>
        </Field>
        {mills.loading && <Loading text="Loading mills" />}
        <ErrorMessage error={mills.error} onRetry={mills.reload} />

        <RecordFields
          fields={FIELDS}
          values={values}
          errors={fieldErrors}
          onChange={(name, value) =>
            setValues((v) => ({ ...v, [name]: value }))
          }
          disabled={locked}
        />

        {flow.step !== "done" && !flow.pending && (
          <Button type="submit" disabled={flow.busy}>
            {flow.busy ? "Working" : "Create batch"}
          </Button>
        )}
      </form>

      <TxProgress flow={flow} />

      {flow.step === "done" && flow.result && (
        <p>
          <Link to={`/batches/${encodeURIComponent(flow.result.batchId)}`}>
            Open batch {flow.result.batchId}
          </Link>{" "}
          <Button variant="secondary" onClick={flow.reset}>
            Start over
          </Button>
        </p>
      )}
    </Card>
  );
}
