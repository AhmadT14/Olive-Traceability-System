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
import FacilityInbox from "../features/facility/Inbox";
import Intake from "../features/facility/Intake";
import ListForPickup from "../features/facility/ListForPickup";
import Label from "../features/facility/Label";
import Inventory from "../features/facility/Inventory";
import { FACILITIES } from "../features/facility/config";
import Participants from "../features/admin/Participants";
import RoleChange from "../features/admin/RoleChange";
import Settings from "../features/settings/Settings";

const facilityRoles = Object.keys(FACILITIES);

// Nav paths that have a real page. The rest show a placeholder.
const PAGES = {
  "/batches": <FindBatch />,
  "/settings": <Settings />,
  "/farmer": <FarmerOverview />,
  "/farmer/batches/new": <CreateBatch />,
  "/transporter/jobs": <JobBoard />,
  "/transporter/active": <MyJobs />,
  "/retailer/inventory": <Inventory />,
  "/admin/participants": <Participants />,
  "/admin/participants/new": <RoleChange key="register" mode="register" />,
  "/admin/participants/revoke": <RoleChange key="revoke" mode="revoke" />,
  ...Object.fromEntries(
    facilityRoles.map((role) => [
      `/${role}/inbox`,
      <FacilityInbox key={role} role={role} />,
    ]),
  ),
};

// Role pages that are not in the sidebar. The facility pages take the role,
// so each role keeps its own form state.
const ROLE_PAGES = [
  {
    role: "transporter",
    path: "/transporter/jobs/:batchId/claim",
    element: <ClaimJob />,
  },
  {
    role: "transporter",
    path: "/transporter/active/:batchId/deliver",
    element: <DeliverJob />,
  },
  ...facilityRoles.flatMap((role) => [
    {
      role,
      path: `/${role}/batches/:batchId/intake`,
      element: <Intake key={role} role={role} />,
    },
    ...(FACILITIES[role].listing
      ? [
          {
            role,
            path: `/${role}/batches/:batchId/list`,
            element: <ListForPickup key={role} role={role} />,
          },
        ]
      : []),
  ]),
];

// Print views, so they have no app shell around them.
const LABEL_ROLES = facilityRoles.filter((role) => FACILITIES[role].qr);

function page(path, title) {
  return PAGES[path] || <RolePlaceholder title={title} />;
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
      {LABEL_ROLES.map((role) => (
        <Route
          key={role}
          path={`/${role}/batches/:batchId/label`}
          element={
            <RequireRole role={role}>
              <Label role={role} />
            </RequireRole>
          }
        />
      ))}
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
        {ROLE_PAGES.map(({ role, path, element }) => (
          <Route
            key={path}
            path={path}
            element={<RequireRole role={role}>{element}</RequireRole>}
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
