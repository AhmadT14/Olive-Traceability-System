export const HASH_FIELDS = {
  // createBatch -> harvestDataHash (farm_records + the batches row)
  farm: [
    "harvest_date",
    "location",
    "olive_type",
    "quantity",
    "cultivation_method",
    "irrigation_method",
    "fertilizer_details",
    "pesticide_details",
    "harvesting_method",
    "quality_details",
    "farm_notes",
  ],

  // claimBatch pickup details, separated by product state at the current stage.
  transporter_olive: [
    "truck_details",
    "quantity_picked_up",
    "pickup_condition",
    "olive_condition",
    "loading_details",
    "transport_conditions",
    "notes",
  ],
  transporter_oil: [
    "truck_details",
    "quantity_picked_up",
    "oil_condition",
    "packaging_condition",
    "loading_details",
    "transport_conditions",
    "notes",
  ],
  // initiateHandover delivery details; these are a separate transaction from claimBatch.
  transporter_olive_outgoing: [
    "quantity_delivered",
    "olive_condition",
    "unloading_details",
    "transport_conditions",
    "notes",
  ],
  transporter_oil_outgoing: [
    "quantity_delivered",
    "oil_condition",
    "packaging_condition",
    "unloading_details",
    "transport_conditions",
    "notes",
  ],

  // confirmReceipt by a mill -> intakeDataHash (mill_olive_records)
  mill_olive: [
    "arrival_condition",
    "quantity_received",
    "olive_quality",
    "storage_condition",
    "notes",
  ],

  // postForPickup / outgoing by a mill -> outgoingDataHash (mill_oil_records)
  mill_oil: [
    "pressing_date",
    "extraction_method",
    "output_quantity",
    "oil_quality",
    "packaging_details",
    "qr_code_reference",
    "notes",
  ],

  // confirmReceipt by a storage facility -> intakeDataHash (storage_records)
  storage: [
    "quantity_received",
    "storage_start_date",
    "expected_duration",
    "conditions",
    "product_condition",
    "notes",
  ],

  // postForPickup by a storage facility -> outgoingDataHash (storage dispatch details)
  storage_outgoing: [
    "quantity_released",
    "storage_end_date",
    "product_condition",
    "packaging_condition",
    "loading_details",
    "notes",
  ],

  // confirmReceipt by an exporter -> intakeDataHash.
  exporter_intake: [
    "quantity_received",
    "shipment_arrival_details",
    "received_product_details",
    "product_condition",
    "notes",
  ],

  // postForPickup by an exporter -> outgoingDataHash.
  exporter_outgoing: [
    "quantity_shipped",
    "shipment_details",
    "product_condition",
    "packaging_condition",
    "notes",
  ],

  // confirmReceipt by an importer -> intakeDataHash (import_records)
  import: [
    "quantity_received",
    "shipment_arrival_details",
    "received_product_details",
    "product_condition",
    "notes",
  ],

  // postForPickup by an importer -> outgoingDataHash.
  importer_outgoing: [
    "quantity_shipped",
    "shipment_details",
    "product_condition",
    "packaging_condition",
    "notes",
  ],

  // confirmReceipt by a retailer -> intakeDataHash (retail_records)
  retail: [
    "quantity_received",
    "final_receipt_details",
    "product_condition",
    "notes",
  ],

};
