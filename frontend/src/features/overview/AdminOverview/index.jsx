import { getAdminParticipants } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import OverviewPage from "../OverviewPage";
import { TEXT } from "../strings";

const T = TEXT.admin;

export default function AdminOverview() {
  const load = useAsync(getAdminParticipants, "admin-overview");
  const all = load.data ? load.data.participants : [];
  const active = all.filter((p) => p.roles.length > 0);
  const unavailable = active.filter(
    (p) => p.availability === "unavailable",
  ).length;
  const to = "/admin/participants";

  const stats = load.data && [
    { label: T.participants, value: all.length, to },
    { label: T.available, value: active.length - unavailable, to },
    { label: T.unavailable, value: unavailable, to },
    { label: T.noRole, value: all.length - active.length, to },
  ];

  return (
    <OverviewPage title={T.title} load={load} stats={stats} links={T.links} />
  );
}
