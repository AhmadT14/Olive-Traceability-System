import { ApiError } from "../api/client";
import { mockCaller, mockRoles } from "./auth";
import { SEED_BATCHES, TAMPERED_TX } from "./seedBatches";

// A small in-memory chain plus database. Responses use the shapes from the
// backend response schemas.

const ZERO = "0x0000000000000000000000000000000000000000";
const CUSTODY_CONTRACT = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512";
const FARM_FIELDS = [
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
];
// Put this text in farm_notes to make the first save fail (tests retry).
const FAIL_SAVE_ONCE = "mock: fail save once";

const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

function randomHash() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return (
    "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  );
}

// Same idea as the backend hash: fixed field order, values as trimmed text.
function canonical(record) {
  return JSON.stringify(
    FARM_FIELDS.map((f) =>
      record[f] === undefined ? "" : String(record[f]).trim(),
    ),
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
  return { batchId, events: batch.events };
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

// Needs from backend: a list of the batches the caller created as farmer.
// Proposed shape { batches: [chain state] }, newest first.
export async function farmerBatchesMock() {
  await wait();
  refresh();
  const caller = mockCaller();
  const list = [];
  for (const [batchId, { chain, events }] of batches) {
    const created = events.find((e) => e.name === "BatchCreated");
    if (created && same(created.args.farmer, caller))
      list.push({ batchId, ...chain });
  }
  return { batches: list.reverse() };
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
    batchId,
    farmer: caller,
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
  block += 1;
  batches.set(action.batchId, {
    chain: {
      status: "Listed",
      stage: "Farm",
      custodian: action.farmer,
      pendingTarget: ZERO,
      destination: action.destination,
    },
    events: [
      {
        name: "BatchCreated",
        txHash,
        blockNumber: block,
        args: {
          batchId: randomHash(),
          farmer: action.farmer,
          destinationAddress: action.destination,
          harvestDataHash: transaction.data,
        },
        details: null,
      },
    ],
  });
  canonicalByTx.set(txHash, action.canonical);
  persist();
  return txHash;
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
  if (record.farm_notes === FAIL_SAVE_ONCE && !failedOnce.has(txHash)) {
    failedOnce.add(txHash);
    persist();
    throw new ApiError(500, "db write failed");
  }
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
