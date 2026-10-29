import { ApiError } from "../api/client";
import { mockCaller, mockRoles } from "./auth";
import { MOCK_ACCOUNTS } from "./participants";

// A small in-memory chain plus database, reset on page reload. Responses use
// the shapes from the backend response schemas.

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

let block = 10;
const batches = new Map();
const prepared = new Map(); // transaction data -> prepared action
const failedOnce = new Set();
const canonicalByTx = new Map(); // txHash -> canonical record from prepare

batches.set("B1", {
  chain: {
    status: "Listed",
    stage: "Farm",
    custodian: MOCK_ACCOUNTS.farmer,
    pendingTarget: ZERO,
    destination: MOCK_ACCOUNTS.mill,
  },
  events: [
    {
      name: "BatchCreated",
      txHash: randomHash(),
      blockNumber: 5,
      args: {
        batchId: randomHash(),
        farmer: MOCK_ACCOUNTS.farmer,
        destinationAddress: MOCK_ACCOUNTS.mill,
        harvestDataHash: randomHash(),
      },
      details: {
        type: "farm",
        payloadVersion: 1,
        recordedAt: "2026-10-20T09:00:00.000Z",
        values: {
          harvest_date: "2026-10-20",
          location: "Jenin",
          olive_type: "Nabali",
          quantity: 1500,
        },
      },
    },
  ],
});

function findBatch(batchId, message) {
  const batch = batches.get(batchId);
  if (!batch) throw new ApiError(404, message);
  return batch;
}

export async function chainMock(batchId) {
  await wait();
  const batch = findBatch(batchId, "batch not found on chain");
  return { batchId, ...batch.chain };
}

export async function historyMock(batchId) {
  await wait();
  const batch = findBatch(batchId, "no events found for this batch");
  return { batchId, events: batch.events };
}

export async function verifyMock(batchId) {
  await wait();
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
      integrity: {
        status: "verified",
        onChainHash: e.args.harvestDataHash,
        computedHash: e.args.harvestDataHash,
      },
    }));
  return {
    batch: { batchId, ...batch.chain },
    integrityStatus: events.length > 0 ? "verified" : "incomplete",
    events,
  };
}

export async function prepareBatchMock(body) {
  await wait();
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
  return txHash;
}

export async function saveBatchMock(body) {
  await wait();
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
  return { batchId, txHash };
}
