import { getMyBatches, getReceivedBatches } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import { FACILITIES } from "../../facility/config";
import OverviewPage from "../OverviewPage";
import { TEXT } from "../strings";

const T = TEXT.facility;

// Overview for mill, storage, exporter, importer and retailer, counted from
// GET /me/batches, plus the received total (mock only for now).
async function loadBatches() {
  const [mine, received] = await Promise.all([
    getMyBatches(),
    getReceivedBatches(),
  ]);
  return { ...mine, received };
}

export default function FacilityOverview({ role }) {
  const load = useAsync(loadBatches, `${role}-overview`);
  const data = load.data;
  const inbox = `/${role}/inbox`;
  const isRetailer = !FACILITIES[role].listing;
  const holdingTo = isRetailer ? "/retailer/inventory" : inbox;

  const stats = data && [
    { label: T.awaiting, value: data.awaitingMyConfirmation.length, to: inbox },
    { label: T.holding[role], value: data.holding.length, to: holdingTo },
    ...(isRetailer
      ? []
      : [{ label: T.listed, value: data.listedByMe.length, to: inbox }]),
    {
      label: T.received,
      value: data.received.available ? data.received.batches.length : null,
    },
  ];
  const links = [
    { to: inbox, label: T.inbox },
    ...(isRetailer ? [{ to: "/retailer/inventory", label: T.inventory }] : []),
  ];

  return (
    <OverviewPage
      title={T.title}
      load={load}
      stats={stats}
      note={data && !data.received.available ? T.receivedNote : null}
      links={links}
    />
  );
}
