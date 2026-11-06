import { ZeroAddress } from "ethers";
import { sameAddress } from "./addresses.js";
import { batchExists, Stage, StageRole } from "./enums.js";

const allow = () => ({ allowed: true, reason: null });
const deny = (reason) => ({ allowed: false, reason });

// The stage a batch moves to when the next participant confirms receipt, or
// null at the final stage.
export function getStageAfter(stage) {
  const index = Stage.indexOf(stage);
  return index >= 0 && index < Stage.length - 1 ? Stage[index + 1] : null;
}

// A participant counts as available unless they have switched themselves to
// "unavailable". A profile that never set a value is therefore available.
export const isAvailable = (availability) => availability !== "unavailable";

// The zero address is how the chain says "nobody" (no pending target, no
// custodian), so it never counts as a participant.
const sameWallet = (left, right) =>
  sameAddress(left, right) && left.toLowerCase() !== ZeroAddress;

// Where a batch belongs on a participant's "my batches" screen, from chain
// state alone. A transporter that has named the next facility still holds the
// batch until that facility confirms receipt, so that stays under "holding".
// Returns null when the batch is not theirs.
export function classifyBatchForParticipant(batch, address) {
  if (!batch) return null;
  if (
    batch.status === "PendingHandover" &&
    sameWallet(batch.pendingTarget, address)
  ) {
    return "awaitingMyConfirmation";
  }
  if (!sameWallet(batch.custodian, address)) return null;
  if (batch.status === "Listed") return "listedByMe";
  if (batch.status === "Created" || batch.status === "PendingHandover") {
    return "holding";
  }
  return null;
}

export function checkCanCreateBatch({ role, batchExists }) {
  if (role !== "FARMER") return deny("caller is not a farmer");
  if (batchExists) return deny("batch already exists");
  return allow();
}

export function checkCanPostForPickup({ batch, actor }) {
  if (!batch || !batchExists(batch)) return deny("batch not found");
  if (!sameAddress(batch.custodian, actor)) {
    return deny("caller is not current custodian");
  }
  if (batch.status !== "Created") return deny("batch not in a listable state");
  if (getStageAfter(batch.stage) === null)
    return deny("batch already at final stage");
  return allow();
}

export function checkCanClaimBatch({ batch, role }) {
  if (role !== "TRANSPORTER") return deny("caller is not a transporter");
  if (!batch || batch.status !== "Listed") {
    return deny("batch not listed for pickup");
  }
  return allow();
}

export function checkCanInitiateHandover({ batch, actor, role, targetRole }) {
  if (!batch || !batchExists(batch)) return deny("batch not found");
  if (!sameAddress(batch.custodian, actor)) {
    return deny("caller is not current custodian");
  }
  if (role !== "TRANSPORTER") return deny("caller is not a transporter");
  if (batch.status !== "Created") {
    return deny("batch not in a handover-ready state");
  }
  const expectedRole = getNextStageRole(batch.stage);
  if (!expectedRole) return deny("no stage after retailer");
  if (targetRole !== expectedRole) return deny("target is not the next stage");
  return allow();
}

export function checkCanConfirmReceipt({ batch, actor }) {
  if (!batch || batch.status !== "PendingHandover") {
    return deny("batch not pending handover");
  }
  if (!sameAddress(batch.pendingTarget, actor)) {
    return deny("caller is not the pending target");
  }
  return allow();
}

export function getNextStageRole(stage) {
  return StageRole[getStageAfter(stage)] ?? null;
}
