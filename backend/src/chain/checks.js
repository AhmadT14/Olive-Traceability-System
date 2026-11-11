import { ZeroAddress } from "ethers";
import { sameAddress } from "./addresses.js";
import { batchExists, Stage, StageRole } from "./enums.js";

const allow = () => ({ allowed: true, reason: null });
const deny = (reason) => ({ allowed: false, reason });

const sameParticipant = (left, right) =>
  sameAddress(left, right) && left.toLowerCase() !== ZeroAddress;

export function getNextStage(stage) {
  const index = Stage.indexOf(stage);
  return index >= 0 && index < Stage.length - 1 ? Stage[index + 1] : null;
}

export function getNextStageRole(stage) {
  return StageRole[getNextStage(stage)] ?? null;
}

export const isAvailable = (availability) => availability !== "unavailable";

export function classifyBatchForParticipant(batch, address) {
  if (!batch) return null;
  if (
    batch.status === "PendingHandover" &&
    sameParticipant(batch.pendingTarget, address)
  ) {
    return "awaitingMyConfirmation";
  }
  if (!sameParticipant(batch.custodian, address)) return null;
  if (batch.status === "Listed" || batch.status === "Reserved") {
    return "listedByMe";
  }
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
  if (getNextStage(batch.stage) === null)
    return deny("batch already at final stage");
  return allow();
}

export function checkCanReserveBatch({ batch, role }) {
  if (role !== "TRANSPORTER") return deny("caller is not a transporter");
  if (!batch || batch.status !== "Listed") {
    return deny("batch not listed for pickup");
  }
  return allow();
}

export function checkCanReleaseBatch({ batch, actor }) {
  if (!batch || batch.status !== "Reserved") return deny("batch not reserved");
  if (
    !sameParticipant(batch.reservedBy, actor) &&
    !sameParticipant(batch.custodian, actor)
  ) {
    return deny("caller cannot release this reservation");
  }
  return allow();
}

export function checkCanClaimBatch({ batch, actor, role }) {
  if (role !== "TRANSPORTER") return deny("caller is not a transporter");
  if (!batch || batch.status !== "Reserved") {
    return deny("batch not reserved for pickup");
  }
  if (!sameParticipant(batch.reservedBy, actor)) {
    return deny("batch reserved by another transporter");
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
