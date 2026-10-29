import { useParams } from "react-router-dom";
import { getBatchChain, getBatchHistory, verifyBatch } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import BatchLookup from "../../../components/BatchLookup";
import BatchStatusCard from "../../../components/BatchStatusCard";
import IntegrityBadge from "../../../components/IntegrityBadge";
import Timeline from "../../../components/Timeline";
import { Loading, EmptyState, ErrorMessage } from "../../../components/State";
import "./style.css";

export default function BatchDetail() {
  const { batchId } = useParams();
  const chain = useAsync(() => getBatchChain(batchId), batchId);
  const history = useAsync(() => getBatchHistory(batchId), batchId);
  const verify = useAsync(() => verifyBatch(batchId), batchId);

  function refresh() {
    chain.reload();
    history.reload();
    verify.reload();
  }

  return (
    <div className="batch-detail">
      <BatchLookup />

      {chain.loading && !chain.data && (
        <Loading text="Reading the batch from the chain" />
      )}
      <ErrorMessage error={chain.error} onRetry={chain.reload} />

      {chain.data && (
        <BatchStatusCard batch={chain.data}>
          <div className="batch-detail__row">
            <span>Integrity:</span>
            {verify.data && (
              <IntegrityBadge status={verify.data.integrityStatus} />
            )}
            {verify.loading && !verify.data && <Loading text="Checking" />}
            <Button variant="secondary" onClick={refresh}>
              Refresh
            </Button>
          </div>
          <ErrorMessage error={verify.error} onRetry={verify.reload} />
        </BatchStatusCard>
      )}

      {!chain.error && (
        <Card title="History">
          {history.loading && !history.data && <Loading />}
          <ErrorMessage error={history.error} onRetry={history.reload} />
          {history.data &&
            (history.data.events.length > 0 ? (
              <Timeline
                events={history.data.events}
                verification={verify.data}
              />
            ) : (
              <EmptyState>No events for this batch yet.</EmptyState>
            ))}
        </Card>
      )}
    </div>
  );
}
