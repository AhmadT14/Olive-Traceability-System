import TxLink from "../../../components/TxLink";
import { TEXT } from "../strings";
import "./style.css";

const TONE = {
  verified: "good",
  mismatch: "bad",
  incomplete: "warn",
  unavailable: "warn",
};

// Overall result of GET /batches/:id/verify, with an expandable list of
// every chain event (block and transaction) as proof.
export default function IntegrityBanner({ verify, events, integrity }) {
  if (verify.loading && !verify.data) {
    return (
      <div className="integrity integrity--checking" role="status">
        {TEXT.integrity.checking}...
      </div>
    );
  }

  const key = verify.data ? verify.data.integrityStatus : "unavailable";
  const info = TEXT.integrity[key] || TEXT.integrity.unavailable;

  return (
    <section className={`integrity integrity--${TONE[key] || "warn"}`}>
      <h2 className="integrity__title">{info.title}</h2>
      <p className="integrity__text">{info.text}</p>
      {events && events.length > 0 && (
        <details className="integrity__proof">
          <summary>{TEXT.integrity.proof}</summary>
          <div className="integrity__table">
            <table>
              <thead>
                <tr>
                  <th>{TEXT.integrity.step}</th>
                  <th>{TEXT.integrity.block}</th>
                  <th>{TEXT.integrity.transaction}</th>
                  <th>{TEXT.integrity.result}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const status = event.details
                    ? integrity.get(event.txHash.toLowerCase()) ||
                      "unverifiable"
                    : "none";
                  return (
                    <tr key={`${event.txHash}-${event.name}`}>
                      <td>{TEXT.events[event.name] || event.name}</td>
                      <td className="integrity__num">{event.blockNumber}</td>
                      <td>
                        <TxLink hash={event.txHash} />
                      </td>
                      <td>{TEXT.integrity.status[status] || status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
