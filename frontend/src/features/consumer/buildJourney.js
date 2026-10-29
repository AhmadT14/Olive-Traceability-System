// The fixed order of facility stages, as named by the contract.
export const STAGES = [
  "Farm",
  "Mill",
  "Storage",
  "Exporter",
  "Importer",
  "Retailer",
];

// Groups history events (in chain order) into the six facility stages.
// Each stage gets the facility that held it, its own records, and `legIn`:
// the transport that brought the batch there (or is bringing it now).
export function buildJourney(events) {
  const stages = STAGES.map((stage) => ({
    stage,
    reached: false,
    facility: null,
    records: [],
    legIn: null,
  }));
  let at = -1;

  const legTo = (index, transporter) => {
    if (index < 1 || index >= stages.length) return null;
    if (!stages[index].legIn) {
      stages[index].legIn = { transporter, records: [], delivered: false };
    }
    return stages[index].legIn;
  };

  for (const event of events) {
    switch (event.name) {
      case "BatchCreated":
        at = 0;
        stages[0].reached = true;
        stages[0].facility = event.args.farmer;
        stages[0].records.push(event);
        break;
      case "BatchListed":
        if (at >= 0) stages[at].records.push(event);
        break;
      case "BatchClaimed": {
        const leg = legTo(at + 1, event.args.transporter);
        if (leg) leg.records.push(event);
        break;
      }
      case "HandoverInitiated": {
        const leg = legTo(at + 1, event.args.currentCustodian);
        if (leg) {
          leg.records.push(event);
          leg.delivered = true;
        }
        break;
      }
      case "ReceiptConfirmed":
        at += 1;
        if (at < stages.length) {
          stages[at].reached = true;
          stages[at].facility = event.args.newCustodian;
          stages[at].records.push(event);
        }
        break;
      default:
        break;
    }
  }
  return stages;
}

// The date a stage was first recorded, from its saved details.
export function firstRecordedAt(records) {
  const withDate = records.find((r) => r.details && r.details.recordedAt);
  return withDate ? withDate.details.recordedAt : null;
}
