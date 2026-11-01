import {
  getCompletedTransporterJobs,
  getMyTransporterJobs,
  getTransporterJobs,
} from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import OverviewPage from "../OverviewPage";
import { TEXT } from "../strings";

const T = TEXT.transporter;

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

  return (
    <OverviewPage
      title={T.title}
      load={load}
      stats={stats}
      note={data && !data.completed.available ? T.completedNote : null}
      links={T.links}
    />
  );
}
