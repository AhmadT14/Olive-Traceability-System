// Record fields per form, in API.md order. `name` is the exact snake_case key
// sent to prepare and save. Types: text, textarea, date, number, integer.
// Units follow the team decision: olives in kg, oil in litres.

const text = (name, label) => ({ name, label, type: "text" });
const area = (name, label) => ({ name, label, type: "textarea" });
const date = (name, label) => ({ name, label, type: "date" });
const qty = (name, label, unit) => ({ name, label, type: "number", unit });
const notes = area("notes", "Notes");

export const RECORD_FIELDS = {
  // location and olive_type are required by the backend code, not by API.md.
  farm: [
    { ...date("harvest_date", "Harvest date"), required: true },
    { ...text("location", "Farm location"), required: true },
    { ...text("olive_type", "Olive variety"), required: true },
    qty("quantity", "Quantity of olives", "kg"),
    text("cultivation_method", "Cultivation method"),
    text("irrigation_method", "Irrigation method"),
    area("fertilizer_details", "Fertilizer details"),
    area("pesticide_details", "Pesticide details"),
    text("harvesting_method", "Harvesting method"),
    area("quality_details", "Quality details"),
    area("farm_notes", "Farm notes"),
  ],
  transport_pickup_olive: [
    text("truck_details", "Truck details"),
    qty("quantity_picked_up", "Quantity picked up", "kg"),
    area("loading_details", "Loading details"),
    area("transport_conditions", "Transport conditions"),
    text("pickup_condition", "Pickup condition"),
    text("olive_condition", "Olive condition"),
    notes,
  ],
  transport_pickup_oil: [
    text("truck_details", "Truck details"),
    qty("quantity_picked_up", "Quantity picked up", "L"),
    area("loading_details", "Loading details"),
    area("transport_conditions", "Transport conditions"),
    text("oil_condition", "Oil condition"),
    text("packaging_condition", "Packaging condition"),
    notes,
  ],
  transport_delivery_olive: [
    qty("quantity_delivered", "Quantity delivered", "kg"),
    area("unloading_details", "Unloading details"),
    area("transport_conditions", "Transport conditions"),
    text("olive_condition", "Olive condition"),
    notes,
  ],
  transport_delivery_oil: [
    qty("quantity_delivered", "Quantity delivered", "L"),
    area("unloading_details", "Unloading details"),
    area("transport_conditions", "Transport conditions"),
    text("oil_condition", "Oil condition"),
    text("packaging_condition", "Packaging condition"),
    notes,
  ],
  mill_receipt: [
    text("arrival_condition", "Arrival condition"),
    qty("quantity_received", "Quantity received", "kg"),
    text("olive_quality", "Olive quality"),
    text("storage_condition", "Storage condition"),
    notes,
  ],
  mill_outgoing: [
    date("pressing_date", "Pressing date"),
    text("extraction_method", "Extraction method"),
    qty("output_quantity", "Oil produced", "L"),
    text("oil_quality", "Oil quality"),
    area("packaging_details", "Packaging details"),
    text("qr_code_reference", "QR code reference"),
    notes,
  ],
  storage_receipt: [
    qty("quantity_received", "Quantity received", "L"),
    date("storage_start_date", "Storage start date"),
    {
      name: "expected_duration",
      label: "Expected duration",
      type: "integer",
      unit: "days",
    },
    area("conditions", "Storage conditions"),
    text("product_condition", "Product condition"),
    notes,
  ],
  storage_outgoing: [
    qty("quantity_released", "Quantity released", "L"),
    date("storage_end_date", "Storage end date"),
    text("product_condition", "Product condition"),
    text("packaging_condition", "Packaging condition"),
    area("loading_details", "Loading details"),
    notes,
  ],
  exporter_receipt: [
    qty("quantity_received", "Quantity received", "L"),
    area("shipment_arrival_details", "Shipment arrival details"),
    area("received_product_details", "Received product details"),
    text("product_condition", "Product condition"),
    notes,
  ],
  exporter_outgoing: [
    qty("quantity_shipped", "Quantity shipped", "L"),
    area("shipment_details", "Shipment details"),
    text("product_condition", "Product condition"),
    text("packaging_condition", "Packaging condition"),
    notes,
  ],
  importer_receipt: [
    qty("quantity_received", "Quantity received", "L"),
    area("shipment_arrival_details", "Shipment arrival details"),
    area("received_product_details", "Received product details"),
    text("product_condition", "Product condition"),
    notes,
  ],
  importer_outgoing: [
    qty("quantity_shipped", "Quantity shipped", "L"),
    area("shipment_details", "Shipment details"),
    text("product_condition", "Product condition"),
    text("packaging_condition", "Packaging condition"),
    notes,
  ],
  retailer_receipt: [
    qty("quantity_received", "Quantity received", "L"),
    area("final_receipt_details", "Final receipt details"),
    text("product_condition", "Product condition"),
    notes,
  ],
};

const LABELS = Object.fromEntries(
  Object.values(RECORD_FIELDS)
    .flat()
    .map((f) => [f.name, f.label]),
);

// Label for a stored field name, used when showing saved record details.
export function fieldLabel(name) {
  if (LABELS[name]) return LABELS[name];
  const words = name.replace(/_/g, " ");
  return words[0].toUpperCase() + words.slice(1);
}

// Stored details types (history `details.type`) and their form in RECORD_FIELDS.
const DETAILS_FORM = {
  farm: "farm",
  transporter_olive_pickup: "transport_pickup_olive",
  transporter_oil_pickup: "transport_pickup_oil",
  transporter_olive_delivery: "transport_delivery_olive",
  transporter_oil_delivery: "transport_delivery_oil",
  mill_intake: "mill_receipt",
  mill_outgoing: "mill_outgoing",
  storage_intake: "storage_receipt",
  storage_outgoing: "storage_outgoing",
  exporter_intake: "exporter_receipt",
  exporter_outgoing: "exporter_outgoing",
  importer_intake: "importer_receipt",
  importer_outgoing: "importer_outgoing",
  retailer_intake: "retailer_receipt",
};

// Saved record values as [{ name, label, value }] in form order, with the
// unit added to quantities. Unknown fields come last.
export function describeRecord(type, values) {
  const fields = RECORD_FIELDS[DETAILS_FORM[type]] || [];
  const known = fields
    .filter((f) => values[f.name] !== undefined && values[f.name] !== "")
    .map((f) => ({
      name: f.name,
      label: f.label,
      value: f.unit ? `${values[f.name]} ${f.unit}` : String(values[f.name]),
    }));
  const extra = Object.keys(values)
    .filter((name) => !fields.some((f) => f.name === name))
    .map((name) => ({
      name,
      label: fieldLabel(name),
      value: String(values[name]),
    }));
  return [...known, ...extra];
}
