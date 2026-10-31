import { fieldLabel } from "../../forms/fields";
import { formatDay } from "../../utils/format";
import { TEXT } from "./strings";

// useTxFlow keys. One pending save per action, like the farmer form, so a
// claim or delivery whose details failed to save must be retried first.
export const CLAIM_KEY = "transporter-claim";
export const DELIVER_KEY = "transporter-handover";

// Olives until the batch leaves the farm, oil after that.
export function productOf(stage) {
  return stage === "Farm" ? "olive" : "oil";
}

export function productLabel(stage) {
  return TEXT.product[productOf(stage)];
}

export function partyName(party) {
  return (party && party.name) || TEXT.unknownFacility;
}

const snake = (key) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

// The job board's outgoingDetails (camelCase) as [{ key, label, value }],
// without empty values. They are oil records, so quantities are in litres.
export function outgoingRows(details) {
  if (!details) return [];
  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== "")
    .map(([key, value]) => {
      const name = snake(key);
      let text = String(value);
      if (name.includes("quantity")) text = `${value} L`;
      else if (name.endsWith("_date")) text = formatDay(value);
      return { key, label: fieldLabel(name), value: text };
    });
}

// Pickup or delivery form for the stage the batch is leaving.
export function pickupForm(stage) {
  return `transport_pickup_${productOf(stage)}`;
}

export function deliveryForm(stage) {
  return `transport_delivery_${productOf(stage)}`;
}
