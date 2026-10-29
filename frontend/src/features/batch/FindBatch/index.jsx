import Card from "../../../components/Card";
import BatchLookup from "../../../components/BatchLookup";

export default function FindBatch() {
  return (
    <Card title="Find a batch">
      <p>Enter a batch ID to see where it is and its full history.</p>
      <BatchLookup />
    </Card>
  );
}
