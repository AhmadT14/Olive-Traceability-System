import { getAdminParticipants, getBatchStats } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import { PARTICIPANT_ROLES, roleLabel } from "../../../auth/roles";
import { perKey } from "../../../utils/stats";
import OverviewPage from "../OverviewPage";
import { TEXT } from "../strings";

const T = TEXT.admin;

async function loadAdmin() {
  const [directory, batches] = await Promise.all([
    getAdminParticipants(),
    getBatchStats(),
  ]);
  return { participants: directory.participants, batches };
}

export default function AdminOverview() {
  const load = useAsync(loadAdmin, "admin-overview");
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

  // A wallet with two roles counts under both.
  const charts = load.data && [
    {
      title: T.perRole,
      data: perKey(all, (p) => p.roles, PARTICIPANT_ROLES, roleLabel),
      unit: T.participantUnit,
      horizontal: true,
    },
    {
      title: T.perStage,
      data: load.data.batches.stages.map((s) => ({
        label: TEXT.stages[s.stage] || s.stage,
        value: s.count,
      })),
      unit: TEXT.batchUnit,
      horizontal: true,
      available: load.data.batches.available,
    },
  ];

  return (
    <OverviewPage
      title={T.title}
      load={load}
      stats={stats}
      charts={charts}
      links={T.links}
    />
  );
}
