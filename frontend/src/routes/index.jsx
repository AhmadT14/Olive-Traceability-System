import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { ROLE_HOME } from "../auth/roles";
import RequireRole from "../auth/RequireRole";
import Home from "../features/public/Home";
import Login from "../features/public/Login";
import NoRole from "../features/public/NoRole";
import NotFound from "../features/public/NotFound";
import AppShell from "../features/shell/AppShell";
import RolePlaceholder from "../features/shell/RolePlaceholder";

function AppHome() {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (!session.activeRole) return <Navigate to="/no-role" replace />;
  return <Navigate to={ROLE_HOME[session.activeRole]} replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/no-role" element={<NoRole />} />
      <Route path="/app" element={<AppHome />} />
      <Route
        element={
          <RequireRole>
            <AppShell />
          </RequireRole>
        }
      >
        {Object.entries(ROLE_HOME).map(([role, path]) => (
          <Route
            key={role}
            path={path}
            element={
              <RequireRole role={role}>
                <RolePlaceholder role={role} />
              </RequireRole>
            }
          />
        ))}
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
