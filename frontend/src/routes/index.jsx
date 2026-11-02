import { lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { ROLE_HOME, ROLE_LABELS, ROLE_NAV, SHARED_NAV } from "../auth/roles";
import RequireRole from "../auth/RequireRole";
import LoadBoundary from "../components/LoadBoundary";
import Home from "../features/public/Home";
import Trace from "../features/consumer/Trace";
import Login from "../features/public/Login";
import NoRole from "../features/public/NoRole";
import NotFound from "../features/public/NotFound";
import { FACILITIES } from "../features/facility/config";

// The public pages above load at once, since QR scans come from phones.
// Everything behind sign in loads when it is opened.
const AppShell = lazy(() => import("../features/shell/AppShell"));
const RolePlaceholder = lazy(() => import("../features/shell/RolePlaceholder"));
const FindBatch = lazy(() => import("../features/batch/FindBatch"));
const BatchDetail = lazy(() => import("../features/batch/BatchDetail"));
const FarmerOverview = lazy(() => import("../features/farmer/Overview"));
const CreateBatch = lazy(() => import("../features/farmer/CreateBatch"));
const JobBoard = lazy(() => import("../features/transporter/JobBoard"));
const ClaimJob = lazy(() => import("../features/transporter/ClaimJob"));
const MyJobs = lazy(() => import("../features/transporter/MyJobs"));
const DeliverJob = lazy(() => import("../features/transporter/DeliverJob"));
const FacilityInbox = lazy(() => import("../features/facility/Inbox"));
const Intake = lazy(() => import("../features/facility/Intake"));
const ListForPickup = lazy(() => import("../features/facility/ListForPickup"));
const Label = lazy(() => import("../features/facility/Label"));
const Inventory = lazy(() => import("../features/facility/Inventory"));
const Participants = lazy(() => import("../features/admin/Participants"));
const RoleChange = lazy(() => import("../features/admin/RoleChange"));
const Settings = lazy(() => import("../features/settings/Settings"));
const AdminOverview = lazy(() => import("../features/overview/AdminOverview"));
const TransporterOverview = lazy(
  () => import("../features/overview/TransporterOverview"),
);
const FacilityOverview = lazy(
  () => import("../features/overview/FacilityOverview"),
);

const facilityRoles = Object.keys(FACILITIES);

// Nav paths that have a real page. The rest show a placeholder.
const PAGES = {
  "/batches": <FindBatch />,
  "/settings": <Settings />,
  "/farmer": <FarmerOverview />,
  "/farmer/batches/new": <CreateBatch />,
  "/transporter": <TransporterOverview />,
  "/transporter/jobs": <JobBoard />,
  "/transporter/active": <MyJobs />,
  "/retailer/inventory": <Inventory />,
  "/admin": <AdminOverview />,
  "/admin/participants": <Participants />,
  "/admin/participants/new": <RoleChange key="register" mode="register" />,
  "/admin/participants/revoke": <RoleChange key="revoke" mode="revoke" />,
  ...Object.fromEntries(
    facilityRoles.map((role) => [
      `/${role}`,
      <FacilityOverview key={role} role={role} />,
    ]),
  ),
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
    <LoadBoundary>
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
    </LoadBoundary>
  );
}
