import { ApiError } from "../api/client";
import { mockCaller, mockRoles } from "./auth";
import {
  isMockAvailable,
  participantsWithRole,
  profileMock,
  resetMockParticipants,
  setMockRoles,
} from "./participants";
import { SEED_BATCHES, TAMPERED_TX } from "./seedBatches";

// A small in-memory chain plus database. Responses use the shapes from the
// backend response schemas.

const ZERO = "0x0000000000000000000000000000000000000000";
const CUSTODY_CONTRACT = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
// Put this text in farm_notes or notes to make the first save fail (tests
// retry).
const FAIL_SAVE_ONCE = "mock: fail save once";

const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

function randomHash() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return (
    "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  );
}

// Stands in for the backend record hash: the same values give the same text.
function canonical(record) {
  return JSON.stringify(
    Object.keys(record)
      .sort()
      .map((k) => [k, String(record[k]).trim()]),
  );
}

// Kept in localStorage, so every tab sees the same mock chain, like a real
// chain. Each mock call reloads it first, so two open tabs (for example a
// farmer and a transporter) never overwrite each other. "Reset mock data" in
// the app header clears it.
const STORE_KEY = "olive_mock_chain";

function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY));
  } catch {
    return null;
  }
}

let block = 100;
const batches = new Map();
const prepared = new Map(); // tx data -> action
const failedOnce = new Set();
const canonicalByTx = new Map(); // txHash -> record

// Replaces the in-memory state with the stored one, then adds any missing
// demo batches.
function refresh() {
  const saved = loadStore();
  // New mock batches get blocks after the demo batches (blocks 20 to 40).
  block = Math.max(saved ? saved.block : 0, 100);
  batches.clear();
  prepared.clear();
  failedOnce.clear();
  canonicalByTx.clear();
  if (saved) {
    saved.batches.forEach(([k, v]) => batches.set(k, v));
    saved.prepared.forEach(([k, v]) => prepared.set(k, v));
    saved.failedOnce.forEach((k) => failedOnce.add(k));
    saved.canonicalByTx.forEach(([k, v]) => canonicalByTx.set(k, v));
  }
  for (const [id, batch] of Object.entries(SEED_BATCHES)) {
    if (!batches.has(id)) batches.set(id, structuredClone(batch));
  }
}

export function resetMockChain() {
  try {
    localStorage.removeItem(STORE_KEY);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("olive_pending_save:")) localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable */
  }
  resetMockParticipants();
  refresh();
}

function persist() {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        block,
        batches: [...batches],
        prepared: [...prepared],
        failedOnce: [...failedOnce],
        canonicalByTx: [...canonicalByTx],
      }),
    );
  } catch {
    /* storage unavailable */
  }
}

function findBatch(batchId, message) {
  const batch = batches.get(batchId);
  if (!batch) throw new ApiError(404, message);
  return batch;
}

export async function chainMock(batchId) {
  await wait();
  refresh();
  const batch = findBatch(batchId, "batch not found on chain");
  return { batchId, ...batch.chain };
}

export async function historyMock(batchId) {
  await wait();
  refresh();
  const batch = findBatch(batchId, "no events found for this batch");
  return {
    batchId,
    events: batch.events,
    participants: participantsOf(batch.events),
  };
}

// `participants` of GET /batches/:id/history: name and location for every
// wallet in the events. Wallets without a profile are left out.
function participantsOf(events) {
  const map = {};
  for (const event of events) {
    for (const value of Object.values(event.args || {})) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(value)) continue;
      const profile = profileMock(value);
      if (profile) {
        map[profile.address] = {
          name: profile.name,
          location: profile.location,
        };
      }
    }
  }
  return map;
}

function integrityOf(event) {
  const onChainHash =
    event.args.harvestDataHash ||
    event.args.outgoingDataHash ||
    event.args.intakeDataHash;
  if (TAMPERED_TX.has(event.txHash)) {
    return {
      status: "hash_mismatch",
      onChainHash,
      computedHash: "0x" + onChainHash.slice(2).split("").reverse().join(""),
    };
  }
  return { status: "verified", onChainHash, computedHash: onChainHash };
}

export async function verifyMock(batchId) {
  await wait();
  refresh();
  const batch = findBatch(batchId, "batch not found");
  const events = batch.events
    .filter((e) => e.details)
    .map((e) => ({
      txHash: e.txHash,
      contractEvent: e.name,
      detailsType: e.details.type,
      payloadVersion: e.details.payloadVersion,
      recordedAt: e.details.recordedAt,
      details: e.details.values,
      integrity: integrityOf(e),
    }));
  const statuses = events.map((e) => e.integrity.status);
  const integrityStatus =
    statuses.length > 0 && statuses.every((s) => s === "verified")
      ? "verified"
      : statuses.some((s) => s === "hash_mismatch" || s === "metadata_mismatch")
        ? "mismatch"
        : "incomplete";
  return { batch: { batchId, ...batch.chain }, integrityStatus, events };
}

const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// Shape of GET /me/batches, sorted like backend chain/checks.js.
export async function myBatchesMock() {
  await wait();
  refresh();
  const caller = mockCaller();
  const result = { holding: [], listedByMe: [], awaitingMyConfirmation: [] };
  for (const [batchId, { chain }] of batches) {
    const item = { batchId, ...chain };
    if (chain.status === "PendingHandover" && same(chain.pendingTarget, caller))
      result.awaitingMyConfirmation.push(item);
    else if (!same(chain.custodian, caller)) continue;
    else if (chain.status === "Listed") result.listedByMe.push(item);
    else result.holding.push(item);
  }
  return result;
}

// Shape of GET /me/batches/created. Like the backend, only batches whose farm
// record was saved are listed, newest first. Demo batches have no block time,
// so their createdAt is the time the farm record was saved.
export async function createdBatchesMock() {
  await wait();
  refresh();
  const caller = mockCaller();
  if (!mockRoles(caller).includes("FARMER")) {
    throw new ApiError(403, "caller is not a farmer");
  }
  const list = [];
  for (const [batchId, { chain, events, createdAt }] of batches) {
    const created = events.find((e) => e.name === "BatchCreated");
    if (!created || !created.details || !same(created.args.farmer, caller))
      continue;
    list.push({
      batchId,
      ...chain,
      harvestDate: created.details.values.harvest_date || null,
      createdBlock: created.blockNumber,
      createdAt: createdAt || created.details.recordedAt,
    });
  }
  list.sort((a, b) => b.createdBlock - a.createdBlock);
  return { batches: list };
}

export async function prepareBatchMock(body) {
  await wait();
  refresh();
  const caller = mockCaller();
  if (!mockRoles(caller).includes("FARMER")) {
    throw new ApiError(403, "caller is not a farmer");
  }
  const { batchId, destinationAddress, ...record } = body;
  const missing = ["harvest_date", "location", "olive_type"].filter(
    (f) => !record[f],
  );
  if (!batchId) missing.push("batchId");
  if (!destinationAddress) missing.push("destinationAddress");
  if (missing.length) {
    throw new ApiError(422, "invalid payload", {
      formErrors: [],
      fieldErrors: Object.fromEntries(missing.map((f) => [f, ["Required"]])),
    });
  }
  if (batches.has(batchId)) throw new ApiError(409, "batch already exists");

  const dataHash = randomHash();
  prepared.set(dataHash, {
    kind: "create",
    batchId,
    caller,
    destination: destinationAddress.toLowerCase(),
    canonical: canonical(record),
  });
  persist();
  return {
    batchId,
    destinationAddress,
    destinationRole: "MILL",
    dataHash,
    // The mock wallet reads the dataHash back from `data`.
    transaction: { to: CUSTODY_CONTRACT, data: dataHash, value: "0x0" },
  };
}

// The chain change for each prepared action, like the contract functions.
// Each returns false when the contract would revert (the state moved on).
const APPLY = {
  create(action, event) {
    batches.set(action.batchId, {
      createdAt: new Date().toISOString(),
      chain: {
        status: "Listed",
        stage: "Farm",
        custodian: action.caller,
        pendingTarget: ZERO,
        destination: action.destination,
      },
      events: [
        event("BatchCreated", {
          farmer: action.caller,
          destinationAddress: action.destination,
          harvestDataHash: action.dataHash,
        }),
      ],
    });
    return true;
  },
  claim(action, event, batch) {
    if (batch.chain.status !== "Listed") return false;
    batch.chain = {
      ...batch.chain,
      status: "Created",
      custodian: action.caller,
    };
    batch.events.push(
      event("BatchClaimed", {
        transporter: action.caller,
        intakeDataHash: action.dataHash,
      }),
    );
    return true;
  },
  handover(action, event, batch) {
    if (
      batch.chain.status !== "Created" ||
      !same(batch.chain.custodian, action.caller)
    )
      return false;
    batch.chain = {
      ...batch.chain,
      status: "PendingHandover",
      pendingTarget: action.target,
    };
    batch.events.push(
      event("HandoverInitiated", {
        currentCustodian: action.caller,
        targetAddress: action.target,
        outgoingDataHash: action.dataHash,
      }),
    );
    return true;
  },
  receipt(action, event, batch) {
    if (
      batch.chain.status !== "PendingHandover" ||
      !same(batch.chain.pendingTarget, action.caller)
    )
      return false;
    batch.chain = {
      status: "Created",
      stage: NEXT_STAGE[batch.chain.stage],
      custodian: action.caller,
      pendingTarget: ZERO,
      destination: ZERO,
    };
    batch.events.push(
      event("ReceiptConfirmed", {
        newCustodian: action.caller,
        intakeDataHash: action.dataHash,
      }),
    );
    return true;
  },
  // Registry grantRole and revokeRole. No batch is involved.
  role(action) {
    const roles = mockRoles(action.address).filter((r) => r !== action.role);
    if (action.action === "register") roles.push(action.role);
    setMockRoles(action.address, roles);
    return true;
  },
  listing(action, event, batch) {
    if (
      batch.chain.status !== "Created" ||
      !same(batch.chain.custodian, action.caller)
    )
      return false;
    batch.chain = {
      ...batch.chain,
      status: "Listed",
      destination: action.destination,
    };
    batch.events.push(
      event("BatchListed", {
        custodian: action.caller,
        destinationAddress: action.destination,
        outgoingDataHash: action.dataHash,
      }),
    );
    return true;
  },
};

// Keeps an action until the mock wallet mines it. Returns the transaction
// data the mock wallet sends back. `canonical` is what minedMockTx returns.
export function prepareMockTx(action) {
  refresh();
  const data = randomHash();
  prepared.set(data, action);
  persist();
  return data;
}

// The `canonical` text of a mined mock transaction, or undefined.
export function minedMockTx(txHash) {
  refresh();
  return canonicalByTx.get(txHash);
}

// Called by the mock wallet in place of MetaMask. Applies the chain change.
export function mineMockTx(transaction) {
  refresh();
  const action = prepared.get(transaction.data);
  if (!action)
    throw Object.assign(new Error("Unknown transaction."), {
      code: "CALL_EXCEPTION",
    });
  prepared.delete(transaction.data);
  const txHash = randomHash();
  const event = (name, args) => ({
    name,
    txHash,
    blockNumber: block + 1,
    args: { batchId: randomHash(), ...args },
    details: null,
  });
  const ok = APPLY[action.kind](
    { ...action, dataHash: transaction.data },
    event,
    batches.get(action.batchId),
  );
  if (!ok)
    throw Object.assign(new Error("Transaction reverted."), {
      code: "CALL_EXCEPTION",
    });
  block += 1;
  canonicalByTx.set(txHash, action.canonical);
  persist();
  return txHash;
}

// Fails the first save of a record whose notes ask for it (tests retry).
export function maybeFailOnce(record, txHash) {
  const text = record.farm_notes || record.notes;
  if (text === FAIL_SAVE_ONCE && !failedOnce.has(txHash)) {
    failedOnce.add(txHash);
    persist();
    throw new ApiError(500, "db write failed");
  }
}

export async function saveBatchMock(body) {
  await wait();
  refresh();
  const { txHash, batchId, ...record } = body;
  const batch = batches.get(batchId);
  const event = batch && batch.events.find((e) => e.txHash === txHash);
  if (!event) {
    throw new ApiError(
      404,
      "tx not found or has no successful BatchCreated event",
    );
  }
  maybeFailOnce(record, txHash);
  if (canonicalByTx.get(txHash) !== canonical(record)) {
    throw new ApiError(409, "record does not match the on-chain hash");
  }
  if (event.details)
    throw new ApiError(409, "batch already recorded off-chain");
  event.details = {
    type: "farm",
    payloadVersion: 1,
    recordedAt: new Date().toISOString(),
    values: record,
  };
  persist();
  return { batchId, txHash };
}

// Transporter jobs. The backend keeps a job table; the mock reads the same
// story from the events: a listing opens a job, BatchClaimed claims it,
// HandoverInitiated hands it over and ReceiptConfirmed completes it.

const LISTING_STAGE = {
  farm: "Farm",
  mill_outgoing: "Mill",
  storage_outgoing: "Storage",
  exporter_outgoing: "Exporter",
  importer_outgoing: "Importer",
};

// Same mapping as backend services/jobs.service.js. Other types give null.
const OUTGOING_DETAILS = {
  storage_outgoing: (d) => ({
    quantityReleased: d.quantity_released ?? null,
    storageEndDate: d.storage_end_date ?? null,
    productCondition: d.product_condition ?? null,
    packagingCondition: d.packaging_condition ?? null,
    loadingDetails: d.loading_details ?? null,
    notes: d.notes ?? null,
  }),
  mill_outgoing: (d) => ({
    pressingDate: d.pressing_date ?? null,
    extractionMethod: d.extraction_method ?? null,
    outputQuantity: d.output_quantity ?? null,
    oilQuality: d.oil_quality ?? null,
    packagingDetails: d.packaging_details ?? null,
    qrCodeReference: d.qr_code_reference ?? null,
    notes: d.notes ?? null,
  }),
};

function party(address) {
  const profile = profileMock(address);
  const roles = profile ? profile.roles : [];
  return { name: profile ? profile.name : null, role: roles[0] || null, roles };
}

// A stable number per listing, like the backend's job row id.
function jobId(txHash) {
  let h = 2166136261;
  for (const ch of txHash) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function jobsOf(batchId, { chain, events, createdAt }) {
  const jobs = [];
  let job = null;
  for (const e of events) {
    if (e.name === "BatchCreated" || e.name === "BatchListed") {
      const type = e.details ? e.details.type : "farm";
      const mapper = e.details && OUTGOING_DETAILS[type];
      job = {
        id: jobId(e.txHash),
        status: "available",
        batchId,
        stage: LISTING_STAGE[type] || chain.stage,
        source: e.args.farmer || e.args.custodian,
        destination: e.args.destinationAddress,
        outgoingDetails: mapper ? mapper(e.details.values) : null,
        createdAt: (e.details && e.details.recordedAt) || createdAt || null,
        transporter: null,
      };
      jobs.push(job);
    } else if (job && e.name === "BatchClaimed") {
      job.status = "claimed";
      job.transporter = e.args.transporter;
    } else if (job && e.name === "HandoverInitiated") {
      job.status = "handover_pending";
    } else if (job && e.name === "ReceiptConfirmed") {
      job.status = "completed";
      job = null;
    }
  }
  return jobs;
}

// eslint-disable-next-line no-unused-vars
function shapeJob({ transporter, source, destination, ...job }) {
  return {
    ...job,
    source: party(source),
    destination: { ...party(destination), address: destination },
  };
}

function requireTransporter(caller) {
  if (!mockRoles(caller).includes("TRANSPORTER")) {
    throw new ApiError(403, "caller is not a transporter");
  }
}

// Shape of GET /transporter-jobs, and with mine=true of
// GET /transporter-jobs?mine=true.
export async function transporterJobsMock({ mine = false } = {}) {
  await wait();
  refresh();
  const caller = mockCaller();
  requireTransporter(caller);
  const list = [];
  for (const [batchId, batch] of batches) {
    for (const job of jobsOf(batchId, batch)) {
      const keep = mine
        ? ["claimed", "handover_pending"].includes(job.status) &&
          same(job.transporter, caller)
        : job.status === "available" && batch.chain.status === "Listed";
      if (keep) list.push(shapeJob(job));
    }
  }
  return { jobs: list };
}

// Needs from backend: no route lists a transporter's completed jobs.
// Same job shape with status "completed", newest first.
export async function completedJobsMock() {
  await wait();
  refresh();
  const caller = mockCaller();
  requireTransporter(caller);
  const list = [];
  for (const [batchId, batch] of batches) {
    for (const job of jobsOf(batchId, batch)) {
      if (job.status === "completed" && same(job.transporter, caller))
        list.push(shapeJob(job));
    }
  }
  return { jobs: list.reverse() };
}

const productOf = (chain) => (chain.stage === "Farm" ? "olive" : "oil");

function preparedTx(action, extra) {
  const dataHash = randomHash();
  prepared.set(dataHash, action);
  persist();
  return {
    batchId: action.batchId,
    ...extra,
    dataHash,
    // The mock wallet reads the dataHash back from `data`.
    transaction: { to: CUSTODY_CONTRACT, data: dataHash, value: "0x0" },
  };
}

export async function prepareClaimMock(body) {
  await wait();
  refresh();
  const caller = mockCaller();
  requireTransporter(caller);
  const { batchId, ...record } = body;
  const batch = findBatch(batchId, "batch not found");
  if (batch.chain.status !== "Listed") {
    throw new ApiError(409, "batch not listed for pickup");
  }
  if (!isMockAvailable(caller)) {
    throw new ApiError(409, "transporter is marked unavailable");
  }
  return preparedTx(
    { kind: "claim", batchId, caller, canonical: canonical(record) },
    { productType: productOf(batch.chain) },
  );
}

export async function prepareHandoverMock(body) {
  await wait();
  refresh();
  const caller = mockCaller();
  requireTransporter(caller);
  const { batchId, targetAddress, ...record } = body;
  const batch = findBatch(batchId, "batch not found");
  if (!same(batch.chain.custodian, caller)) {
    throw new ApiError(409, "caller is not current custodian");
  }
  if (batch.chain.status !== "Created") {
    throw new ApiError(409, "batch not in a handover-ready state");
  }
  if (!same(batch.chain.destination, targetAddress)) {
    throw new ApiError(
      400,
      "target must match the destination selected for this job",
    );
  }
  return preparedTx(
    {
      kind: "handover",
      batchId,
      caller,
      target: targetAddress.toLowerCase(),
      canonical: canonical(record),
    },
    { targetAddress, productType: productOf(batch.chain) },
  );
}

// Saves a record on the event mined by txHash. `type` is the stored details
// type, or a function of the batch for types that depend on its stage.
function saveEventRecord(batchId, body, eventName, type) {
  refresh();
  const { txHash, ...record } = body;
  const batch = batches.get(batchId);
  const event = batch && batch.events.find((e) => e.txHash === txHash);
  if (!event || event.name !== eventName) {
    throw new ApiError(404, `tx not found or has no ${eventName} event`);
  }
  maybeFailOnce(record, txHash);
  if (canonicalByTx.get(txHash) !== canonical(record)) {
    throw new ApiError(409, "record does not match the on-chain hash");
  }
  if (event.details) throw new ApiError(409, "record already saved");
  event.details = {
    type: typeof type === "function" ? type(batch) : type,
    payloadVersion: 1,
    recordedAt: new Date().toISOString(),
    values: record,
  };
  persist();
  return event;
}

// The stage has not changed during transport: it is the stage the batch left.
const transportType = (kind) => (batch) =>
  `transporter_${productOf(batch.chain)}_${kind}`;

export async function saveClaimMock(batchId, body) {
  await wait();
  const event = saveEventRecord(
    batchId,
    body,
    "BatchClaimed",
    transportType("pickup"),
  );
  return {
    batchId,
    txHash: event.txHash,
    transporter: event.args.transporter,
    productType: productOf(batches.get(batchId).chain),
  };
}

export async function saveHandoverMock(batchId, body) {
  await wait();
  const event = saveEventRecord(
    batchId,
    body,
    "HandoverInitiated",
    transportType("delivery"),
  );
  return {
    batchId,
    txHash: event.txHash,
    targetAddress: event.args.targetAddress,
    productType: productOf(batches.get(batchId).chain),
  };
}

// Receipt and listing. NEXT_ROLE and NEXT_STAGE follow the fixed chain order.
const NEXT_STAGE = {
  Farm: "Mill",
  Mill: "Storage",
  Storage: "Exporter",
  Exporter: "Importer",
  Importer: "Retailer",
};
const NEXT_ROLE = {
  Farm: "MILL",
  Mill: "STORAGE",
  Storage: "EXPORTER",
  Exporter: "IMPORTER",
  Importer: "RETAILER",
};

// Shape of POST /batches/prepare-receipt.
export async function prepareReceiptMock(body) {
  await wait();
  refresh();
  const caller = mockCaller();
  const { batchId, ...record } = body;
  const batch = findBatch(batchId, "batch not found");
  const role = NEXT_ROLE[batch.chain.stage];
  if (!role) throw new ApiError(409, "batch is already at final stage");
  if (!mockRoles(caller).includes(role)) {
    throw new ApiError(403, `caller is not a ${role.toLowerCase()}`);
  }
  if (batch.chain.status !== "PendingHandover") {
    throw new ApiError(409, "batch not pending handover");
  }
  if (!same(batch.chain.pendingTarget, caller)) {
    throw new ApiError(409, "caller is not the pending target");
  }
  return preparedTx(
    { kind: "receipt", batchId, caller, canonical: canonical(record) },
    {},
  );
}

// Shape of GET /batches/:id/destinations.
export async function batchDestinationsMock(batchId) {
  await wait();
  refresh();
  const caller = mockCaller();
  const batch = findBatch(batchId, "batch not found");
  if (batch.chain.status !== "Created") {
    throw new ApiError(409, "batch is not ready to be listed for pickup");
  }
  if (!same(batch.chain.custodian, caller)) {
    throw new ApiError(403, "caller is not current custodian");
  }
  const role = NEXT_ROLE[batch.chain.stage];
  if (!role) throw new ApiError(409, "batch is already at final stage");
  return {
    batchId,
    stage: batch.chain.stage,
    role,
    destinations: participantsWithRole(role),
  };
}

// The listing rules per role, like backend services/prepare.service.js
// LISTINGS. Storage, exporter and importer must have saved their intake
// record before they can list.
const LISTINGS = {
  mill: { role: "MILL", stage: "Mill", what: "a mill", intake: null },
  storage: {
    role: "STORAGE",
    stage: "Storage",
    what: "a storage facility",
    intake: "storage_intake",
  },
  exporter: {
    role: "EXPORTER",
    stage: "Exporter",
    what: "an exporter",
    intake: "exporter_intake",
  },
  importer: {
    role: "IMPORTER",
    stage: "Importer",
    what: "an importer",
    intake: "importer_intake",
  },
};

// Shape of POST /batches/prepare-listing and the storage, exporter and
// importer listing routes.
export async function prepareStageListingMock(kind, body) {
  await wait();
  refresh();
  const spec = LISTINGS[kind];
  const caller = mockCaller();
  if (!mockRoles(caller).includes(spec.role)) {
    throw new ApiError(403, `caller is not ${spec.what}`);
  }
  const { batchId, destinationAddress, ...record } = body;
  if (!destinationAddress) {
    throw new ApiError(422, "invalid payload", {
      formErrors: [],
      fieldErrors: { destinationAddress: ["Required"] },
    });
  }
  const batch = findBatch(batchId, "batch not found");
  if (batch.chain.stage !== spec.stage) {
    throw new ApiError(
      409,
      `batch is not at the ${spec.stage.toLowerCase()} stage`,
    );
  }
  if (
    batch.chain.status !== "Created" ||
    !same(batch.chain.custodian, caller)
  ) {
    throw new ApiError(409, "caller is not current custodian");
  }
  if (
    spec.intake &&
    !batch.events.some((e) => e.details && e.details.type === spec.intake)
  ) {
    throw new ApiError(
      409,
      `no ${kind} intake recorded off-chain for this batch yet`,
    );
  }
  const nextRole = NEXT_ROLE[spec.stage];
  if (!mockRoles(destinationAddress).includes(nextRole)) {
    throw new ApiError(400, `destination must have ${nextRole} role`);
  }
  const destination = destinationAddress.toLowerCase();
  return preparedTx(
    {
      kind: "listing",
      batchId,
      caller,
      destination,
      canonical: canonical(record),
    },
    { destinationAddress: destination, destinationRole: nextRole },
  );
}

// POST /batches/:id/mill-intake and /mill-outgoing return { batchId, txHash }.
export async function saveMillIntakeMock(batchId, body) {
  await wait();
  const event = saveEventRecord(
    batchId,
    body,
    "ReceiptConfirmed",
    "mill_intake",
  );
  return { batchId, txHash: event.txHash };
}

export async function saveMillOutgoingMock(batchId, body) {
  await wait();
  const event = saveEventRecord(batchId, body, "BatchListed", "mill_outgoing");
  return { batchId, txHash: event.txHash };
}

// POST /batches/:id/receipt. The stage the batch is in now (the receiver's)
// picks the record type, like backend receiptSchemas.
const RECEIPTS = {
  Storage: { type: "storage_intake", stage: "storage" },
  Exporter: { type: "exporter_intake", stage: "exporter_intake" },
  Importer: { type: "importer_intake", stage: "import" },
  Retailer: { type: "retailer_intake", stage: "retail" },
};

export async function saveReceiptMock(batchId, body) {
  await wait();
  refresh();
  const batch = findBatch(batchId, "batch not found");
  const receipt = RECEIPTS[batch.chain.stage];
  if (!receipt) {
    throw new ApiError(
      409,
      `receipt persistence is not defined for stage ${batch.chain.stage}`,
    );
  }
  const event = saveEventRecord(
    batchId,
    body,
    "ReceiptConfirmed",
    receipt.type,
  );
  return { batchId, txHash: event.txHash, stage: receipt.stage };
}

// POST /batches/:id/storage-outgoing, /exporter-outgoing, /importer-outgoing.
export async function saveOutgoingMock(kind, batchId, body) {
  await wait();
  const event = saveEventRecord(
    batchId,
    body,
    "BatchListed",
    `${kind}_outgoing`,
  );
  return { batchId, txHash: event.txHash };
}
