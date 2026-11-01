import {
  getCompletedTransporterJobs,
  getMyTransporterJobs,
  getTransporterJobs,
} from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import { perKey } from "../../../utils/stats";
import OverviewPage from "../OverviewPage";
import { TEXT } from "../strings";

const T = TEXT.transporter;
const LEGS = Object.keys(T.legs);
const byLeg = (jobs) =>
  perKey(
    jobs,
    (j) => j.stage,
    LEGS,
    (s) => T.legs[s],
  );

async function loadJobs() {
  const [open, mine, completed] = await Promise.all([
    getTransporterJobs(),
    getMyTransporterJobs(),
    getCompletedTransporterJobs(),
  ]);
  return { open: open.jobs, mine: mine.jobs, completed };
}

export default function TransporterOverview() {
  const load = useAsync(loadJobs, "transporter-overview");
  const data = load.data;
  const count = (status) => data.mine.filter((j) => j.status === status).length;
  const stats = data && [
    { label: T.open, value: data.open.length, to: "/transporter/jobs" },
    { label: T.carrying, value: count("claimed"), to: "/transporter/active" },
    {
      label: T.handedOver,
      value: count("handover_pending"),
      to: "/transporter/active",
    },
    {
      label: T.completed,
      value: data.completed.available ? data.completed.jobs.length : null,
      to: "/transporter/active",
    },
  ];

  const charts = data && [
    {
      title: T.openByLeg,
      data: byLeg(data.open),
      unit: TEXT.jobUnit,
      horizontal: true,
    },
    {
      title: T.completedByLeg,
      data: byLeg(data.completed.jobs),
      unit: TEXT.jobUnit,
      horizontal: true,
      available: data.completed.available,
    },
  ];

  return (
    <OverviewPage
      title={T.title}
      load={load}
      stats={stats}
      charts={charts}
      note={data && !data.completed.available ? T.completedNote : null}
      links={T.links}
    />
  );
}
