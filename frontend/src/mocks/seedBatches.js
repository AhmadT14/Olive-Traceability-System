import { MOCK_ACCOUNTS as A } from "./participants";

// Demo batches for the mock chain, shaped like GET /batches/:id/history
// events plus the GET /batches/:id/chain state.
//   B1      at the farm, waiting for pickup (matches seed.sh)
//   DEMO-1  full journey, farm to retailer
//   DEMO-2  pressed at the mill, waiting for pickup to storage
//   DEMO-3  at the mill, but the mill intake record was changed afterwards

const ZERO = "0x0000000000000000000000000000000000000000";

// Fixed fake hashes, so the demo data is the same on every load.
function hashOf(text) {
  let out = "";
  for (let i = 0; out.length < 64; i += 1) {
    let h = 2166136261;
    for (const ch of `${text}#${i}`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619) >>> 0;
    }
    out += h.toString(16).padStart(8, "0");
  }
  return "0x" + out.slice(0, 64);
}

const HASH_ARG = {
  BatchCreated: "harvestDataHash",
  BatchListed: "outgoingDataHash",
  BatchClaimed: "intakeDataHash",
  HandoverInitiated: "outgoingDataHash",
  ReceiptConfirmed: "intakeDataHash",
};

function journey(batchId, steps) {
  return steps.map(([name, args, type, values, day], i) => ({
    name,
    txHash: hashOf(`${batchId} tx ${i}`),
    blockNumber: 20 + i * 3,
    args: {
      batchId: hashOf(batchId),
      ...args,
      [HASH_ARG[name]]: hashOf(`${batchId} data ${i}`),
    },
    details: type
      ? {
          type,
          payloadVersion: 1,
          recordedAt: `2026-${day}T10:00:00.000Z`,
          values,
        }
      : null,
  }));
}

const FARM = {
  harvest_date: "2026-10-05",
  location: "Burqin, Jenin",
  olive_type: "Nabali Baladi",
  quantity: 1200,
  cultivation_method: "Rain-fed, traditional terraces",
  harvesting_method: "Hand picked",
  pesticide_details: "None used",
  quality_details: "Healthy fruit, no fly damage",
};

const TO_MILL = [
  [
    "BatchClaimed",
    { transporter: A.transporter },
    "transporter_olive_pickup",
    {
      truck_details: "Isuzu NPR, plate 7-1234-95",
      quantity_picked_up: 1200,
      pickup_condition: "Ventilated crates",
      olive_condition: "Fresh",
    },
    "10-05",
  ],
  [
    "HandoverInitiated",
    { currentCustodian: A.transporter, targetAddress: A.mill },
    "transporter_olive_delivery",
    {
      quantity_delivered: 1195,
      olive_condition: "Fresh",
      transport_conditions: "Covered, 2 hour trip",
    },
    "10-05",
  ],
  [
    "ReceiptConfirmed",
    { newCustodian: A.mill },
    "mill_intake",
    {
      arrival_condition: "Good",
      quantity_received: 1195,
      olive_quality: "Grade A",
      storage_condition: "Shaded, pressed same day",
    },
    "10-05",
  ],
];

const MILL_OUT = {
  pressing_date: "2026-10-06",
  extraction_method: "Cold extraction, two phase",
  output_quantity: 210,
  oil_quality: "Extra virgin, acidity 0.3%",
  packaging_details: "Stainless steel tanks",
};

const DEMO_1 = journey("DEMO-1", [
  [
    "BatchCreated",
    { farmer: A.farmer, destinationAddress: A.mill },
    "farm",
    FARM,
    "10-05",
  ],
  ...TO_MILL,
  [
    "BatchListed",
    { custodian: A.mill, destinationAddress: A.storage },
    "mill_outgoing",
    { ...MILL_OUT, qr_code_reference: "/trace/DEMO-1" },
    "10-06",
  ],
  [
    "BatchClaimed",
    { transporter: A.transporter },
    "transporter_oil_pickup",
    {
      truck_details: "Isuzu NPR, plate 7-1234-95",
      quantity_picked_up: 210,
      oil_condition: "Clear",
      packaging_condition: "Sealed tanks",
    },
    "10-07",
  ],
  [
    "HandoverInitiated",
    { currentCustodian: A.transporter, targetAddress: A.storage },
    "transporter_oil_delivery",
    {
      quantity_delivered: 210,
      oil_condition: "Clear",
      packaging_condition: "Sealed",
    },
    "10-07",
  ],
  [
    "ReceiptConfirmed",
    { newCustodian: A.storage },
    "storage_intake",
    {
      quantity_received: 210,
      storage_start_date: "2026-10-07",
      expected_duration: 14,
      conditions: "Dark room, 16 to 18 C",
      product_condition: "Good",
    },
    "10-07",
  ],
  [
    "BatchListed",
    { custodian: A.storage, destinationAddress: A.exporter },
    "storage_outgoing",
    {
      quantity_released: 210,
      storage_end_date: "2026-10-21",
      product_condition: "Good",
      packaging_condition: "Bottled, 500 ml",
    },
    "10-21",
  ],
  [
    "BatchClaimed",
    { transporter: A.transporter },
    "transporter_oil_pickup",
    {
      quantity_picked_up: 210,
      oil_condition: "Clear",
      packaging_condition: "Boxed bottles",
    },
    "10-21",
  ],
  [
    "HandoverInitiated",
    { currentCustodian: A.transporter, targetAddress: A.exporter },
    "transporter_oil_delivery",
    { quantity_delivered: 210, oil_condition: "Clear" },
    "10-21",
  ],
  [
    "ReceiptConfirmed",
    { newCustodian: A.exporter },
    "exporter_intake",
    {
      quantity_received: 210,
      product_condition: "Good",
      received_product_details: "420 bottles of 500 ml",
    },
    "10-22",
  ],
  [
    "BatchListed",
    { custodian: A.exporter, destinationAddress: A.importer },
    "exporter_outgoing",
    {
      quantity_shipped: 210,
      shipment_details: "Via Allenby crossing",
      product_condition: "Good",
      packaging_condition: "Palletised",
    },
    "10-23",
  ],
  [
    "BatchClaimed",
    { transporter: A.transporter },
    "transporter_oil_pickup",
    {
      quantity_picked_up: 210,
      oil_condition: "Clear",
      packaging_condition: "Palletised",
    },
    "10-23",
  ],
  [
    "HandoverInitiated",
    { currentCustodian: A.transporter, targetAddress: A.importer },
    "transporter_oil_delivery",
    { quantity_delivered: 210, oil_condition: "Clear" },
    "10-24",
  ],
  [
    "ReceiptConfirmed",
    { newCustodian: A.importer },
    "importer_intake",
    {
      quantity_received: 210,
      shipment_arrival_details: "Customs cleared in Amman",
      product_condition: "Good",
    },
    "10-24",
  ],
  [
    "BatchListed",
    { custodian: A.importer, destinationAddress: A.retailer },
    "importer_outgoing",
    {
      quantity_shipped: 50,
      shipment_details: "First delivery to retail",
      product_condition: "Good",
    },
    "10-25",
  ],
  [
    "BatchClaimed",
    { transporter: A.transporter },
    "transporter_oil_pickup",
    { quantity_picked_up: 50, oil_condition: "Clear" },
    "10-25",
  ],
  [
    "HandoverInitiated",
    { currentCustodian: A.transporter, targetAddress: A.retailer },
    "transporter_oil_delivery",
    { quantity_delivered: 50, oil_condition: "Clear" },
    "10-26",
  ],
  [
    "ReceiptConfirmed",
    { newCustodian: A.retailer },
    "retailer_intake",
    {
      quantity_received: 50,
      final_receipt_details: "On shelf from 27 October",
      product_condition: "Good",
    },
    "10-26",
  ],
]);

const DEMO_2 = journey("DEMO-2", [
  [
    "BatchCreated",
    { farmer: A.farmer, destinationAddress: A.mill },
    "farm",
    FARM,
    "10-05",
  ],
  ...TO_MILL,
  [
    "BatchListed",
    { custodian: A.mill, destinationAddress: A.storage },
    "mill_outgoing",
    { ...MILL_OUT, qr_code_reference: "/trace/DEMO-2" },
    "10-06",
  ],
]);

const DEMO_3 = journey("DEMO-3", [
  [
    "BatchCreated",
    { farmer: A.farmer, destinationAddress: A.mill },
    "farm",
    FARM,
    "10-05",
  ],
  ...TO_MILL,
]);

const B1 = journey("B1", [
  [
    "BatchCreated",
    { farmer: A.farmer, destinationAddress: A.mill },
    "farm",
    {
      harvest_date: "2026-10-20",
      location: "Jenin",
      olive_type: "Nabali",
      quantity: 1500,
    },
    "10-20",
  ],
]);

export const SEED_BATCHES = {
  B1: {
    chain: {
      status: "Listed",
      stage: "Farm",
      custodian: A.farmer,
      pendingTarget: ZERO,
      destination: A.mill,
    },
    events: B1,
  },
  "DEMO-1": {
    chain: {
      status: "Created",
      stage: "Retailer",
      custodian: A.retailer,
      pendingTarget: ZERO,
      destination: ZERO,
    },
    events: DEMO_1,
  },
  "DEMO-2": {
    chain: {
      status: "Listed",
      stage: "Mill",
      custodian: A.mill,
      pendingTarget: ZERO,
      destination: A.storage,
    },
    events: DEMO_2,
  },
  "DEMO-3": {
    chain: {
      status: "Created",
      stage: "Mill",
      custodian: A.mill,
      pendingTarget: ZERO,
      destination: ZERO,
    },
    events: DEMO_3,
  },
};

// Records whose stored details no longer match the hash on chain.
export const TAMPERED_TX = new Set([DEMO_3[3].txHash]);
