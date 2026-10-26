import { Navigate } from "react-router-dom";
import { useAuth } from "../../../auth/useAuth";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import "./style.css";

export default function NoRole() {
  const { session, logout } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (session.activeRole) return <Navigate to="/app" replace />;

  return (
    <main className="no-role">
      <Card title="No role for this wallet">
        <p>
          This wallet is not registered yet. Contact the ministry to be added,
          then sign in again.
        </p>
        <Button variant="secondary" onClick={() => logout()}>
          Sign out
        </Button>
      </Card>
    </main>
  );
}
