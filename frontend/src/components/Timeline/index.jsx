import IntegrityBadge from "../IntegrityBadge";
import ParticipantName from "../ParticipantName";
import TxLink from "../TxLink";
import Badge from "../Badge";
import { describeRecord } from "../../forms/fields";
import { formatDate } from "../../utils/format";
import "./style.css";

// Contract events, with the args that name who acted and who receives next.
const EVENTS = {
  BatchCreated: {
    title: "Batch created",
    actor: "farmer",
    target: "destinationAddress",
  },
  BatchListed: {
    title: "Listed for pickup",
    actor: "custodian",
    target: "destinationAddress",
  },
  BatchClaimed: { title: "Picked up by transporter", actor: "transporter" },
  HandoverInitiated: {
    title: "Delivered, waiting for confirmation",
    actor: "currentCustodian",
    target: "targetAddress",
  },
  ReceiptConfirmed: { title: "Receipt confirmed", actor: "newCustodian" },
};

function Details({ details }) {
  const rows = describeRecord(details.type, details.values || {});
  if (rows.length === 0) return null;
  return (
    <dl className="timeline__details">
      {rows.map((row) => (
        <div key={row.name} className="timeline__detail">
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Batch history (GET /batches/:id/history). `verification` is the optional
// GET /batches/:id/verify response, used for a badge on each event.
export default function Timeline({ events, verification }) {
  const integrityByTx = new Map(
    ((verification && verification.events) || []).map((e) => [
      e.txHash.toLowerCase(),
      e.integrity.status,
    ]),
  );

  return (
    <ol className="timeline">
      {events.map((event) => {
        const info = EVENTS[event.name] || { title: event.name };
        const integrity = integrityByTx.get(event.txHash.toLowerCase());
        return (
          <li key={`${event.txHash}-${event.name}`} className="timeline__item">
            <div className="timeline__head">
              <strong>{info.title}</strong>
              {event.details ? (
                integrity && <IntegrityBadge status={integrity} />
              ) : (
                <Badge>No details saved</Badge>
              )}
            </div>
            <p className="timeline__meta">
              {info.actor && event.args[info.actor] && (
                <>
                  By <ParticipantName address={event.args[info.actor]} />
                </>
              )}
              {info.target && event.args[info.target] && (
                <>
                  {" "}
                  to <ParticipantName address={event.args[info.target]} />
                </>
              )}
            </p>
            <p className="timeline__meta">
              Block {event.blockNumber}
              {event.details &&
                `, saved ${formatDate(event.details.recordedAt)}`}
              , transaction <TxLink hash={event.txHash} />
            </p>
            {event.details && <Details details={event.details} />}
          </li>
        );
      })}
    </ol>
  );
}
