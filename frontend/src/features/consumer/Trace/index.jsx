import { Link, useParams } from "react-router-dom";
import { getBatchChain, getBatchHistory, verifyBatch } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import BatchLookup from "../../../components/BatchLookup";
import Button from "../../../components/Button";
import { Loading } from "../../../components/State";
import { isZeroAddress } from "../../../utils/format";
import Facility from "../Facility";
import IntegrityBanner from "../IntegrityBanner";
import Journey from "../Journey";
import { TEXT } from "../strings";
import "./style.css";

function Now({ batch }) {
  const pending = batch.status === "PendingHandover";
  const address =
    pending && !isZeroAddress(batch.pendingTarget)
      ? batch.pendingTarget
      : batch.custodian;
  return (
    <p className="trace__now">
      {TEXT.trace.now[batch.status] || TEXT.trace.now.Created}{" "}
      <Facility address={address} withLocation />
      {pending && `, ${TEXT.trace.pendingSuffix}`}
    </p>
  );
}

function Problem({ title, text, onRetry }) {
  return (
    <section className="trace__problem" role="alert">
      {title && <h1 className="trace__problem-title">{title}</h1>}
      <p>{text}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {TEXT.trace.retry}
        </Button>
      )}
    </section>
  );
}

// Public page a QR code opens. No wallet and no login.
export default function Trace() {
  const { batchId } = useParams();
  const chain = useAsync(() => getBatchChain(batchId), batchId);
  const history = useAsync(() => getBatchHistory(batchId), batchId);
  const verify = useAsync(() => verifyBatch(batchId), batchId);

  const integrity = new Map(
    ((verify.data && verify.data.events) || []).map((e) => [
      e.txHash.toLowerCase(),
      e.integrity.status,
    ]),
  );
  const notFound = chain.error && chain.error.status === 404;
  const batch = chain.data;

  return (
    <div className="trace">
      <header className="trace__bar">
        <Link to="/" className="trace__brand">
          {TEXT.brand}
        </Link>
      </header>

      <main className="trace__main">
        {chain.loading && !batch && <Loading text={TEXT.trace.loading} />}

        {notFound && (
          <Problem
            title={TEXT.trace.notFoundTitle}
            text={TEXT.trace.notFound}
          />
        )}
        {chain.error && !notFound && (
          <Problem text={TEXT.trace.error} onRetry={chain.reload} />
        )}

        {batch && (
          <>
            <section className="trace__summary">
              <p className="trace__eyebrow">
                {batch.stage === "Farm"
                  ? TEXT.trace.product.olives
                  : TEXT.trace.product.oil}
              </p>
              <h1 className="trace__title">
                {TEXT.trace.batch} {batch.batchId}
              </h1>
              <Now batch={batch} />
            </section>

            <IntegrityBanner
              verify={verify}
              events={history.data && history.data.events}
              integrity={integrity}
            />

            <section>
              <h2 className="trace__section-title">
                {TEXT.trace.journeyTitle}
              </h2>
              {history.loading && !history.data && <Loading />}
              {history.error && (
                <Problem text={TEXT.trace.error} onRetry={history.reload} />
              )}
              {history.data && (
                <Journey events={history.data.events} integrity={integrity} />
              )}
            </section>

            <p className="trace__footer">{TEXT.trace.footer}</p>
          </>
        )}

        {(batch || notFound) && (
          <section className="trace__another">
            <h2 className="trace__section-title">{TEXT.trace.another}</h2>
            <BatchLookup basePath="/trace" text={TEXT.landing.search} />
          </section>
        )}
      </main>
    </div>
  );
}
