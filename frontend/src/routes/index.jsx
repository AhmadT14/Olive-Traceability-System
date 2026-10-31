import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { ROLE_HOME, ROLE_LABELS, ROLE_NAV, SHARED_NAV } from "../auth/roles";
import RequireRole from "../auth/RequireRole";
import Home from "../features/public/Home";
import Trace from "../features/consumer/Trace";
import Login from "../features/public/Login";
import NoRole from "../features/public/NoRole";
import NotFound from "../features/public/NotFound";
import AppShell from "../features/shell/AppShell";
import RolePlaceholder from "../features/shell/RolePlaceholder";
import FindBatch from "../features/batch/FindBatch";
import BatchDetail from "../features/batch/BatchDetail";
import FarmerOverview from "../features/farmer/Overview";
import CreateBatch from "../features/farmer/CreateBatch";
import JobBoard from "../features/transporter/JobBoard";
import ClaimJob from "../features/transporter/ClaimJob";
import MyJobs from "../features/transporter/MyJobs";
import DeliverJob from "../features/transporter/DeliverJob";

// Nav paths that have a real page. The rest show a placeholder.
const PAGES = {
  "/batches": FindBatch,
  "/farmer": FarmerOverview,
  "/farmer/batches/new": CreateBatch,
  "/transporter/jobs": JobBoard,
  "/transporter/active": MyJobs,
};

// Role pages that are not in the sidebar.
const ROLE_PAGES = [
  {
    role: "transporter",
    path: "/transporter/jobs/:batchId/claim",
    Page: ClaimJob,
  },
  {
    role: "transporter",
    path: "/transporter/active/:batchId/deliver",
    Page: DeliverJob,
  },
];

function page(path, title) {
  const Page = PAGES[path];
  return Page ? <Page /> : <RolePlaceholder title={title} />;
}

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
      <Route path="/trace" element={<Navigate to="/" replace />} />
      <Route path="/trace/:batchId" element={<Trace />} />
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
        {Object.entries(ROLE_NAV).flatMap(([role, links]) =>
          links.map((link) => (
            <Route
              key={link.path}
              path={link.path}
              element={
                <RequireRole role={role}>
                  {page(link.path, `${ROLE_LABELS[role]}: ${link.label}`)}
                </RequireRole>
              }
            />
          )),
        )}
        {ROLE_PAGES.map(({ role, path, Page }) => (
          <Route
            key={path}
            path={path}
            element={
              <RequireRole role={role}>
                <Page />
              </RequireRole>
            }
          />
        ))}
        {SHARED_NAV.map((link) => (
          <Route
            key={link.path}
            path={link.path}
            element={page(link.path, link.label)}
          />
        ))}
        <Route path="/batches/:batchId" element={<BatchDetail />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
