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

  // confirmReceipt by an importer -> intakeDataHash (import_records)
  import: [
    "quantity_received",
    "shipment_arrival_details",
    "received_product_details",
    "product_condition",
    "notes",
  ],

  // confirmReceipt by a retailer -> intakeDataHash (retail_records)
  retail: [
    "quantity_received",
    "final_receipt_details",
    "product_condition",
    "notes",
  ],

  // NOT DEFINED YET, waiting on the schema decisions (Flags C and D):
  // transporter pickup / delivery, transporter_jobs listing,
  // storage intake / outgoing, export intake / outgoing.
};
