import Button from "../Button";

// A list's Refresh button. The list stays visible while it reloads, so the
// button is what shows that something is happening.
export default function RefreshButton({ loading, onClick, children }) {
  return (
    <Button variant="secondary" onClick={onClick} disabled={loading}>
      {loading ? "Refreshing" : children}
    </Button>
  );
}
