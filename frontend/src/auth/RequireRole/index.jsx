import { Navigate } from "react-router-dom";
import { useAuth } from "../useAuth";

// A role page opens only for the active role, so the header, the sidebar and
// the page always agree. Other roles of the same wallet use the role switcher.
export default function RequireRole({ role, children }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (!session.activeRole) return <Navigate to="/no-role" replace />;
  if (role && session.activeRole !== role)
    return <Navigate to="/app" replace />;
  return children;
}
