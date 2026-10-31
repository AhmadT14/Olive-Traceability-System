import { FACILITIES } from "./config";
import { TEXT } from "./strings";

const enc = encodeURIComponent;

// useTxFlow keys. One pending save per action and role: a receipt or listing
// whose details failed to save must be retried before the next one.
export const intakeKey = (role) => `${role}-intake`;
export const listKey = (role) => `${role}-listing`;

export const inboxPath = (role) => `/${role}/inbox`;
export const intakePath = (role, id) => `/${role}/batches/${enc(id)}/intake`;
export const listPath = (role, id) => `/${role}/batches/${enc(id)}/list`;
export const labelPath = (role, id) => `/${role}/batches/${enc(id)}/label`;
export const batchPath = (id) => `/batches/${enc(id)}`;

// The public page a consumer reaches from the QR code. The record keeps the
// path, so it stays valid wherever the site is hosted.
export const tracePath = (id) => `/trace/${enc(id)}`;
export const traceUrl = (id) => `${window.location.origin}${tracePath(id)}`;

// For PendingNotice: where to retry each kind of save for this role.
export function pendingKinds(role) {
  const kinds = [
    {
      key: intakeKey(role),
      text: TEXT.pending.intake,
      path: (id) => intakePath(role, id),
    },
  ];
  if (FACILITIES[role].listing) {
    kinds.push({
      key: listKey(role),
      text: TEXT.pending.listing,
      path: (id) => listPath(role, id),
    });
  }
  return kinds;
}

export const same = (a, b) =>
  String(a || "").toLowerCase() === String(b || "").toLowerCase();

// The saved payload minus the fields that are not record fields.
export function keptValues(payload, ...drop) {
  const record = { ...payload };
  for (const name of ["batchId", ...drop]) delete record[name];
  return record;
}
