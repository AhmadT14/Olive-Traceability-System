import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Field from "../Field";
import Button from "../Button";
import "./style.css";

const DEFAULT_TEXT = {
  label: "Batch ID",
  placeholder: "For example B1",
  submit: "Find batch",
  empty: "Enter a batch ID.",
  tooLong: "A batch ID has at most 64 characters.",
};

// Batch ID search box that opens the batch page (`basePath/:id`).
export default function BatchLookup({ basePath = "/batches", text = {} }) {
  const navigate = useNavigate();
  const [batchId, setBatchId] = useState("");
  const [error, setError] = useState("");
  const t = { ...DEFAULT_TEXT, ...text };

  function submit(event) {
    event.preventDefault();
    const id = batchId.trim();
    if (!id) return setError(t.empty);
    if (id.length > 64) return setError(t.tooLong);
    setError("");
    navigate(`${basePath}/${encodeURIComponent(id)}`);
  }

  return (
    <form className="batch-lookup" onSubmit={submit}>
      <Field label={t.label} name="lookup-batch-id" error={error}>
        <input
          id="lookup-batch-id"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          placeholder={t.placeholder}
          autoComplete="off"
        />
      </Field>
      <Button type="submit">{t.submit}</Button>
    </form>
  );
}
