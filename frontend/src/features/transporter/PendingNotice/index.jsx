import { Link } from "react-router-dom";
import { readPendingSave } from "../../../wallet/useTxFlow";
import { CLAIM_KEY, DELIVER_KEY } from "../jobs";
import { TEXT } from "../strings";
import "./style.css";

const enc = encodeURIComponent;
const KINDS = [
  {
    key: CLAIM_KEY,
    text: TEXT.pending.claim,
    path: (id) => `/transporter/jobs/${enc(id)}/claim`,
  },
  {
    key: DELIVER_KEY,
    text: TEXT.pending.handover,
    path: (id) => `/transporter/active/${enc(id)}/deliver`,
  },
];

// Points to a pickup or delivery whose details still need saving. `only`
// limits it to one key; `except` hides the batch the page already shows.
export default function PendingNotice({ only, except, blocked = false }) {
  const items = KINDS.filter((k) => !only || k.key === only)
    .map((k) => ({ ...k, pending: readPendingSave(k.key) }))
    .filter((k) => k.pending && k.pending.payload.batchId !== except);
  if (items.length === 0) return null;

  return items.map(({ key, text, path, pending }) => {
    const id = pending.payload.batchId;
    return (
      <div key={key} className="pending-notice" role="status">
        <p>{text(id)}</p>
        {blocked && <p>{TEXT.pending.blocked}</p>}
        <Link to={path(id)}>{TEXT.pending.open}</Link>
      </div>
    );
  });
}
