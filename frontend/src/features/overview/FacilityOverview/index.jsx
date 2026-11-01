import { getMyBatches, getReceivedBatches } from "../../../api";
import { useAsync } from "../../../hooks/useAsync";
import { perMonth } from "../../../utils/stats";
import { FACILITIES } from "../../facility/config";
import { TEXT as FACILITY_TEXT } from "../../facility/strings";
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
  const received = data && data.received;
  const unit = FACILITY_TEXT.roles[role].unit;
  const charts = received && [
    {
      title: T.receivedPerMonth,
      data: perMonth(received.batches, (b) => b.receivedAt),
      unit: TEXT.batchUnit,
      available: received.available,
    },
    {
      title: T.quantityPerMonth(unit),
      data: perMonth(received.batches, (b) => b.receivedAt, {
        amountOf: (b) => b.quantityReceived,
      }),
      unit,
      available: received.available,
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
      charts={charts}
      note={data && !data.received.available ? T.receivedNote : null}
      links={links}
    />
  );
}
