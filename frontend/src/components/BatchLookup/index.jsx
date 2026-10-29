import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Field from "../Field";
import Button from "../Button";
import "./style.css";

// Batch ID search box that opens the batch page (`basePath/:id`).
export default function BatchLookup({ basePath = "/batches" }) {
  const navigate = useNavigate();
  const [batchId, setBatchId] = useState("");
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    const id = batchId.trim();
    if (!id) return setError("Enter a batch ID.");
    if (id.length > 64)
      return setError("A batch ID has at most 64 characters.");
    setError("");
    navigate(`${basePath}/${encodeURIComponent(id)}`);
  }

  return (
    <form className="batch-lookup" onSubmit={submit}>
      <Field label="Batch ID" name="lookup-batch-id" error={error}>
        <input
          id="lookup-batch-id"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          placeholder="For example B1"
        />
      </Field>
      <Button type="submit">Find batch</Button>
    </form>
  );
}
