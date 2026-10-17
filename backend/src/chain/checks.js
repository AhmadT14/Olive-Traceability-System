import { Stage, Status } from "./enums.js";

const NEXT_STAGE_ROLE = {
  Farm: "MILL",
  Mill: "STORAGE",
  Storage: "EXPORTER",
  Exporter: "IMPORTER",
  Importer: "RETAILER",
};

const allow = () => ({ allowed: true, reason: null });
const deny = (reason) => ({ allowed: false, reason });

function sameAddress(left, right) {
  return (
    typeof left === "string" &&
    typeof right === "string" &&
    left.toLowerCase() === right.toLowerCase()
  );
}

export function checkCanCreateBatch({ role, batchExists }) {
  if (role !== "FARMER") return deny("caller is not a farmer");
  if (batchExists) return deny("batch already exists");
  return allow();
}

export function checkCanPostForPickup({ batch, actor }) {
  if (!batch || batch.status === Status[0]) return deny("batch not found");
  if (!sameAddress(batch.custodian, actor)) {
    return deny("caller is not current custodian");
  }
  if (batch.status !== "Created") return deny("batch not in a listable state");
  if (batch.stage === "Retailer") return deny("batch already at final stage");
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
  if (!batch || batch.status === Status[0]) return deny("batch not found");
  if (!sameAddress(batch.custodian, actor)) {
    return deny("caller is not current custodian");
  }
  if (role !== "TRANSPORTER") return deny("caller is not a transporter");
  if (batch.status !== "Created") {
    return deny("batch not in a handover-ready state");
  }
  const expectedRole = NEXT_STAGE_ROLE[batch.stage];
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
  return NEXT_STAGE_ROLE[stage] ?? null;
}

export function isKnownStage(stage) {
  return Stage.includes(stage);
}
