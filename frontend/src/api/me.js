import { request } from "./client";
import { USE_MOCKS } from "./config";
import { getBatchHistory } from "./batches";
import { myProfileMock } from "../mocks/me";
import { myBatchesMock, farmerBatchesMock } from "../mocks/batches";

// { address, roles, profile: { name, contactPhone, email, address, location,
// availability, details } }. 404 when the wallet has no profile.
export async function getMyProfile() {
  if (USE_MOCKS) return myProfileMock();
  return request("/me/profile", { auth: true });
}

// { holding, listedByMe, awaitingMyConfirmation }, each a list of chain states.
export async function getMyBatches() {
  if (USE_MOCKS) return myBatchesMock();
  return request("/me/batches", { auth: true });
}

// Adds createdBlock and harvestDate from the BatchCreated event, so the list
// can be sorted newest first and show the harvest date.
// TODO: remove once the farmer batch route returns harvest_date and the
// creation time (see "Needs from backend" in docs/progress.md).
async function withCreation(batch) {
  try {
    const { events } = await getBatchHistory(batch.batchId);
    const created = events.find((e) => e.name === "BatchCreated");
    return {
      ...batch,
      createdBlock: created ? created.blockNumber : 0,
      harvestDate:
        created && created.details ? created.details.values.harvest_date : null,
    };
  } catch {
    return { ...batch, createdBlock: 0, harvestDate: null };
  }
}

// Every batch the farmer created, with its current chain state, newest first.
// Needs from backend: no route lists these yet. Until then the real API only
// gives the farmer's own batches still waiting for pickup, so `complete` is
// false there. The mock returns the full list.
export async function getFarmerBatches() {
  let batches;
  let complete;
  if (USE_MOCKS) {
    batches = (await farmerBatchesMock()).batches;
    complete = true;
  } else {
    const mine = await getMyBatches();
    batches = [...mine.listedByMe, ...mine.holding];
    complete = false;
  }
  const rows = await Promise.all(batches.map(withCreation));
  rows.sort((a, b) => b.createdBlock - a.createdBlock);
  return { batches: rows, complete };
}
