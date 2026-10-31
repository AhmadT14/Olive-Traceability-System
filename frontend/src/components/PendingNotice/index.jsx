import { Link } from "react-router-dom";
import { readPendingSave } from "../../wallet/useTxFlow";
import "./style.css";

// Points to a record whose transaction is on chain but whose details still
// need saving. `kinds` is [{ key, text(batchId), path(batchId) }], one per
// useTxFlow key. `only` limits it to one key.
export default function PendingNotice({ kinds, only, blocked = false }) {
  const items = kinds
    .filter((k) => !only || k.key === only)
    .map((k) => ({ ...k, pending: readPendingSave(k.key) }))
    .filter((k) => k.pending);
  if (items.length === 0) return null;

  return items.map(({ key, text, path, pending }) => {
    const id = pending.payload.batchId;
    return (
      <div key={key} className="pending-notice" role="status">
        <p>{text(id)}</p>
        {blocked && (
          <p>
            Finish saving that one first. You cannot start another until it is
            saved.
          </p>
        )}
        <Link to={path(id)}>Open it and retry saving</Link>
      </div>
    );
  });
}
