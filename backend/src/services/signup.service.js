import { hasAdminRole, hasRole } from "../chain/reader.js";
import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  internalError,
  isUniqueViolation,
  notFound,
} from "../errors.js";
import * as applicationRepository from "../db/repositories/registrationApplication.repository.js";
import { jobIdParamSchema } from "../validation/request.schemas.js";
import { parseBody } from "../validation/parse.js";
import {
  approveApplicationSchema,
  rejectApplicationSchema,
  submitApplicationSchema,
} from "../validation/signup.schemas.js";
import { confirmRoleChange, prepareRoleChange } from "./admin.service.js";
import { buildRoleProfile } from "./roleProfile.js";

const toApplicationView = (row) => ({
  id: row.id,
  address: row.walletAddress,
  role: row.role,
  status: row.status,
  profile: row.profile,
  rejectionReason: row.rejectionReason ?? null,
  reviewedBy: row.reviewedBy ?? null,
  createdAt: row.createdAt,
  reviewedAt: row.reviewedAt ?? null,
});

function parseApplicationId(raw) {
  const parsed = jobIdParamSchema.safeParse(raw);
  if (!parsed.success) throw badRequest("invalid application id");
  return parsed.data;
}

async function requireAdmin(user) {
  if (!(await hasAdminRole(user.address))) {
    throw forbidden("caller is not a registry admin");
  }
}

async function findPendingApplication(id) {
  const [row] = await applicationRepository.findById(id);
  if (!row) throw notFound("application not found");
  if (row.status !== "pending") {
    throw conflict(`application is already ${row.status}`);
  }
  return row;
}

async function resolveApplication(id, review) {
  const [row] = await applicationRepository.resolve(id, review);
  if (row) return { application: toApplicationView(row) };
  await findPendingApplication(id);
  throw conflict("application state changed");
}

function withErrors(message, work) {
  return work().catch((err) => {
    if (err instanceof AppError) throw err;
    throw internalError(message, err);
  });
}

export async function submitApplication(user, body) {
  const { role, profile } = parseBody(submitApplicationSchema, body);
  const wallet = user.address.toLowerCase();
  const { updates } = buildRoleProfile(wallet, role, profile);

  return withErrors("application save failed", async () => {
    if (await hasRole(role, user.address)) {
      throw conflict("wallet already has this role");
    }
    try {
      const [row] = await applicationRepository.insert({
        walletAddress: wallet,
        role,
        profile: updates,
      });
      return { application: toApplicationView(row) };
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw conflict("an application is already pending for this wallet");
      }
      throw err;
    }
  });
}

export async function prepareApproval(user, rawId) {
  const id = parseApplicationId(rawId);

  return withErrors("application lookup failed", async () => {
    await requireAdmin(user);
    const application = await findPendingApplication(id);
    return prepareRoleChange(user, {
      address: application.walletAddress,
      role: application.role,
      action: "register",
    });
  });
}

export async function approveApplication(user, rawId, body) {
  const id = parseApplicationId(rawId);
  const { txHash } = parseBody(approveApplicationSchema, body);

  return withErrors("application approval failed", async () => {
    await requireAdmin(user);
    const application = await findPendingApplication(id);
    await confirmRoleChange(user, {
      address: application.walletAddress,
      role: application.role,
      action: "register",
      txHash,
      profile: application.profile,
    });
    return resolveApplication(id, {
      status: "approved",
      reviewedBy: user.address.toLowerCase(),
    });
  });
}

export async function rejectApplication(user, rawId, body) {
  const id = parseApplicationId(rawId);
  const { reason } = parseBody(rejectApplicationSchema, body);

  return withErrors("application rejection failed", async () => {
    await requireAdmin(user);
    await findPendingApplication(id);
    return resolveApplication(id, {
      status: "rejected",
      reviewedBy: user.address.toLowerCase(),
      rejectionReason: reason,
    });
  });
}
