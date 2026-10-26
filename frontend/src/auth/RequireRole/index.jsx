import { Navigate } from "react-router-dom";
import { useAuth } from "..";

export default function RequireRole({ role, children }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (!session.activeRole) return <Navigate to="/no-role" replace />;
  if (role && !session.roles.includes(role))
    return <Navigate to="/app" replace />;
  return children;
}
