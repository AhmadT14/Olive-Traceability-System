import { TX_STEPS } from "../../wallet/useTxFlow";
import Button from "../Button";
import TxLink from "../TxLink";
import "./style.css";

function stepStatus(flow, index) {
  if (flow.step === "done") return "done";
  const current = flow.step === "error" ? flow.failedStep : flow.step;
  const at = TX_STEPS.findIndex((s) => s.key === current);
  if (index < at) return "done";
  if (index > at) return "todo";
  return flow.step === "error" ? "failed" : "active";
}

// Progress of a useTxFlow run, with the retry button for a failed save.
export default function TxProgress({ flow }) {
  if (flow.step === "idle") return null;

  return (
    <div className="tx-progress">
      <ol className="tx-progress__steps">
        {TX_STEPS.map((s, i) => (
          <li
            key={s.key}
            className={`tx-progress__step tx-progress__step--${stepStatus(flow, i)}`}
          >
            {s.label}
          </li>
        ))}
      </ol>
      {flow.txHash && (
        <p className="tx-progress__line">
          Transaction: <TxLink hash={flow.txHash} />
        </p>
      )}
      {flow.error && (
        <p className="tx-progress__error" role="alert">
          {flow.error.message}
        </p>
      )}
      {flow.pending && (
        <div className="tx-progress__retry">
          <p className="tx-progress__line">
            The transaction
            {flow.pending.payload.batchId
              ? ` for batch ${flow.pending.payload.batchId}`
              : ""}{" "}
            is already on chain. Only its details still need saving, so you will
            not be asked to sign again.
          </p>
          <Button onClick={flow.retrySave} disabled={flow.busy}>
            Retry saving details
          </Button>
        </div>
      )}
      {flow.step === "done" && (
        <p className="tx-progress__success" role="status">
          Saved on chain and in the database.
        </p>
      )}
    </div>
  );
}
