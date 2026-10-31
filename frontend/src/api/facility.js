import { request } from "./client";
import { USE_MOCKS } from "./config";
import {
  saveReceiptMock,
  prepareStageListingMock,
  saveOutgoingMock,
} from "../mocks/batches";

const enc = encodeURIComponent;

function post(path, body) {
  return request(path, { method: "POST", body, auth: true });
}

// Body: txHash and the same receipt fields sent to prepareReceipt. For
// storage, exporter, importer and retailer (the mill has saveMillIntake).
export async function saveReceipt(batchId, body) {
  if (USE_MOCKS) return saveReceiptMock(batchId, body);
  return post(`/batches/${enc(batchId)}/receipt`, body);
}

// Body: batchId, destinationAddress (an exporter) and the storage outgoing
// fields.
export async function prepareStorageListing(body) {
  if (USE_MOCKS) return prepareStageListingMock("storage", body);
  return post("/batches/prepare-storage-listing", body);
}

// Body: txHash and the same storage outgoing fields sent to prepare.
export async function saveStorageOutgoing(batchId, body) {
  if (USE_MOCKS) return saveOutgoingMock("storage", batchId, body);
  return post(`/batches/${enc(batchId)}/storage-outgoing`, body);
}

// Body: batchId, destinationAddress (an importer) and the exporter outgoing
// fields.
export async function prepareExporterListing(body) {
  if (USE_MOCKS) return prepareStageListingMock("exporter", body);
  return post("/batches/prepare-exporter-listing", body);
}

export async function saveExporterOutgoing(batchId, body) {
  if (USE_MOCKS) return saveOutgoingMock("exporter", batchId, body);
  return post(`/batches/${enc(batchId)}/exporter-outgoing`, body);
}

// Body: batchId, destinationAddress (a retailer) and the importer outgoing
// fields.
export async function prepareImporterListing(body) {
  if (USE_MOCKS) return prepareStageListingMock("importer", body);
  return post("/batches/prepare-importer-listing", body);
}

export async function saveImporterOutgoing(batchId, body) {
  if (USE_MOCKS) return saveOutgoingMock("importer", batchId, body);
  return post(`/batches/${enc(batchId)}/importer-outgoing`, body);
}
