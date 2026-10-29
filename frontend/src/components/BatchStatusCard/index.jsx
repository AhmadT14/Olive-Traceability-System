import Card from "../Card";
import StageBadge from "../StageBadge";
import StatusBadge from "../StatusBadge";
import ParticipantName from "../ParticipantName";
import { isZeroAddress } from "../../utils/format";
import "./style.css";

// Current chain state of a batch (GET /batches/:id/chain response).
export default function BatchStatusCard({ batch, children }) {
  return (
    <Card title={`Batch ${batch.batchId}`}>
      <dl className="batch-status">
        <dt>Product</dt>
        <dd>{batch.stage === "Farm" ? "Olives" : "Olive oil"}</dd>
        <dt>Stage</dt>
        <dd>
          <StageBadge stage={batch.stage} />
        </dd>
        <dt>Status</dt>
        <dd>
          <StatusBadge status={batch.status} />
        </dd>
        <dt>Held by</dt>
        <dd>
          <ParticipantName address={batch.custodian} />
        </dd>
        {!isZeroAddress(batch.destination) && (
          <>
            <dt>Going to</dt>
            <dd>
              <ParticipantName address={batch.destination} />
            </dd>
          </>
        )}
        {!isZeroAddress(batch.pendingTarget) && (
          <>
            <dt>Waiting for</dt>
            <dd>
              <ParticipantName address={batch.pendingTarget} />
            </dd>
          </>
        )}
      </dl>
      {children}
    </Card>
  );
}
