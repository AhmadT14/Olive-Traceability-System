import { request } from "./client";
import { USE_MOCKS } from "./config";
import {
  chainMock,
  historyMock,
  verifyMock,
  prepareBatchMock,
  saveBatchMock,
} from "../mocks/batches";

const enc = encodeURIComponent;

export async function getBatchChain(batchId) {
  if (USE_MOCKS) return chainMock(batchId);
  return request(`/batches/${enc(batchId)}/chain`);
}

export async function getBatchHistory(batchId) {
  if (USE_MOCKS) return historyMock(batchId);
  return request(`/batches/${enc(batchId)}/history`);
}

export async function verifyBatch(batchId) {
  if (USE_MOCKS) return verifyMock(batchId);
  return request(`/batches/${enc(batchId)}/verify`);
}

// Body: batchId, destinationAddress and the farm record fields.
export async function prepareBatch(body) {
  if (USE_MOCKS) return prepareBatchMock(body);
  return request("/batches/prepare", { method: "POST", body, auth: true });
}

// Body: txHash, batchId and the same farm record fields sent to prepare.
export async function saveBatch(body) {
  if (USE_MOCKS) return saveBatchMock(body);
  return request("/batches", { method: "POST", body, auth: true });
}
