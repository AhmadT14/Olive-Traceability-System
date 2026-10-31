import { TEXT } from "./strings";

// useTxFlow keys. One pending save per action: a receipt or listing whose
// details failed to save must be retried before the next one.
export const INTAKE_KEY = "mill-intake";
export const LIST_KEY = "mill-listing";

const enc = encodeURIComponent;

export const intakePath = (id) => `/mill/batches/${enc(id)}/intake`;
export const listPath = (id) => `/mill/batches/${enc(id)}/list`;
export const labelPath = (id) => `/mill/batches/${enc(id)}/label`;

// The public page a consumer reaches from the QR code. The record keeps the
// path, so it stays valid wherever the site is hosted.
export const tracePath = (id) => `/trace/${enc(id)}`;

// For PendingNotice: where to retry each kind of save.
export const PENDING_KINDS = [
  { key: INTAKE_KEY, text: TEXT.pending.intake, path: intakePath },
  { key: LIST_KEY, text: TEXT.pending.listing, path: listPath },
];

export const same = (a, b) =>
  String(a || "").toLowerCase() === String(b || "").toLowerCase();

// The saved payload minus the fields that are not record fields.
export function keptValues(payload, ...drop) {
  const record = { ...payload };
  for (const name of ["batchId", ...drop]) delete record[name];
  return record;
}
