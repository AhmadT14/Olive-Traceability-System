import Facility from "../Facility";
import RecordBlock from "../RecordBlock";
import { buildJourney, firstRecordedAt } from "../buildJourney";
import { formatDay } from "../../../utils/format";
import { TEXT } from "../strings";
import "./style.css";

function Leg({ leg, integrity }) {
  return (
    <div className="journey__leg">
      <p className="journey__leg-title">
        {leg.delivered
          ? TEXT.trace.transport.by
          : TEXT.trace.transport.inTransit}{" "}
        <Facility address={leg.transporter} />
      </p>
      <details className="journey__leg-details">
        <summary>{TEXT.trace.transport.details}</summary>
        {leg.records.map((event) => (
          <RecordBlock
            key={`${event.txHash}-${event.name}`}
            event={event}
            integrity={integrity}
          />
        ))}
      </details>
    </div>
  );
}

// Farm to retailer, one item per stage. Stages not reached yet say so.
export default function Journey({ events, integrity }) {
  const stages = buildJourney(events);

  return (
    <ol className="journey">
      {stages.map((s) => {
        const label = TEXT.trace.stages[s.stage];
        const date = firstRecordedAt(s.records);
        return (
          <li
            key={s.stage}
            className={`journey__stage${s.reached ? "" : " journey__stage--pending"}`}
          >
            {s.legIn && <Leg leg={s.legIn} integrity={integrity} />}
            <div className="journey__card">
              <div className="journey__head">
                <span className="journey__role">{label.role}</span>
                {s.reached ? (
                  date && (
                    <span className="journey__date">{formatDay(date)}</span>
                  )
                ) : (
                  <span className="journey__date">{TEXT.trace.notYet}</span>
                )}
              </div>
              <h3 className="journey__title">{label.title}</h3>
              {s.reached && (
                <>
                  <p className="journey__facility">
                    <Facility address={s.facility} withLocation />
                  </p>
                  {s.records.map((event) => (
                    <RecordBlock
                      key={`${event.txHash}-${event.name}`}
                      event={event}
                      integrity={integrity}
                    />
                  ))}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
