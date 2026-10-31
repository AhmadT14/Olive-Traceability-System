import {
  saveMillIntake,
  prepareMillListing,
  saveMillOutgoing,
  saveReceipt,
  prepareStorageListing,
  saveStorageOutgoing,
  prepareExporterListing,
  saveExporterOutgoing,
  prepareImporterListing,
  saveImporterOutgoing,
} from "../../api";

// The facility roles in chain order. Each one confirms receipt of a batch
// handed over from the `from` stage, then (except the retailer) lists it for
// the next role. `receipt` and `listing.fields` are RECORD_FIELDS keys.
// `qr` adds the QR preview and the print label.
export const FACILITIES = {
  mill: {
    stage: "Mill",
    from: "Farm",
    receipt: "mill_receipt",
    saveReceipt: saveMillIntake,
    listing: {
      fields: "mill_outgoing",
      prepare: prepareMillListing,
      save: saveMillOutgoing,
    },
    qr: true,
  },
  storage: {
    stage: "Storage",
    from: "Mill",
    receipt: "storage_receipt",
    saveReceipt,
    listing: {
      fields: "storage_outgoing",
      prepare: prepareStorageListing,
      save: saveStorageOutgoing,
    },
  },
  exporter: {
    stage: "Exporter",
    from: "Storage",
    receipt: "exporter_receipt",
    saveReceipt,
    listing: {
      fields: "exporter_outgoing",
      prepare: prepareExporterListing,
      save: saveExporterOutgoing,
    },
  },
  importer: {
    stage: "Importer",
    from: "Exporter",
    receipt: "importer_receipt",
    saveReceipt,
    listing: {
      fields: "importer_outgoing",
      prepare: prepareImporterListing,
      save: saveImporterOutgoing,
    },
  },
  retailer: {
    stage: "Retailer",
    from: "Importer",
    receipt: "retailer_receipt",
    saveReceipt,
    listing: null,
    qr: true,
  },
};
