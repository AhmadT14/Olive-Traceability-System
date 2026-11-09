import { hasAdminRole } from "../chain/reader.js";
import { AppError, forbidden, internalError } from "../errors.js";
import * as applicationRepository from "../repositories/registrationApplication.repository.js";
import {
  parseApplicationStatusQuery,
  parsePageQuery,
} from "../validation/parse.js";

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

export async function getMyApplication(user) {
  try {
    const [row] = await applicationRepository.findLatestByWallet(
      user.address.toLowerCase(),
    );
    return { application: row ? toApplicationView(row) : null };
  } catch (err) {
    throw internalError("application lookup failed", err);
  }
}

export async function listApplications(user, query) {
  const status = parseApplicationStatusQuery(query.status);
  const page = parsePageQuery(query);

  try {
    if (!(await hasAdminRole(user.address))) {
      throw forbidden("caller is not a registry admin");
    }

    const rows = await applicationRepository.list({ status, ...page });
    return { applications: rows.map(toApplicationView) };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw internalError("application lookup failed", err);
  }
}
