import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubModule, stubReader } from "./support/stubModule.js";
import {
  applicationsResponseSchema,
  myApplicationResponseSchema,
  pendingSavesResponseSchema,
} from "../src/validation/response.schemas.js";

const reader = stubReader();
const applicationsRepo = stubModule(
  "db/repositories/registrationApplication.repository.js",
  ["findLatestByWallet", "list"],
);
const { getMyApplication, listApplications } =
  await import("../src/services/applications.service.js");

const ADMIN = "0xAAAA000000000000000000000000000000000001";
const APPLICANT = "0xBBBB000000000000000000000000000000000002";
const ROW = {
  id: 1,
  walletAddress: APPLICANT.toLowerCase(),
  role: "MILL",
  status: "rejected",
  profile: { name: "New Mill" },
  rejectionReason: "licence missing",
  reviewedBy: ADMIN.toLowerCase(),
  createdAt: new Date("2026-11-09T09:00:00Z"),
  reviewedAt: new Date("2026-11-09T11:00:00Z"),
};

let asked;
beforeEach(() => {
  asked = [];
  reader.hasAdminRole = async (address) => address === ADMIN;
  applicationsRepo.findLatestByWallet = async (wallet) => {
    asked.push(wallet);
    return wallet === APPLICANT.toLowerCase() ? [ROW] : [];
  };
  applicationsRepo.list = async (filter) => {
    asked.push(filter);
    return [ROW];
  };
});

test("an applicant sees their latest application, or null", async () => {
  const mine = await getMyApplication({ address: APPLICANT });
  assert.deepEqual(asked, [APPLICANT.toLowerCase()]);
  assert.equal(mine.application.status, "rejected");
  assert.equal(mine.application.rejectionReason, "licence missing");
  assert.equal(mine.application.address, APPLICANT.toLowerCase());
  assert.ok(myApplicationResponseSchema.safeParse(mine).success);
  const none = await getMyApplication({ address: ADMIN });
  assert.deepEqual(none, { application: null });
  assert.ok(myApplicationResponseSchema.safeParse(none).success);
});

test("the admin lists applications by status with paging", async () => {
  const result = await listApplications(
    { address: ADMIN },
    { status: "pending", limit: "5", offset: "10" },
  );
  assert.deepEqual(asked, [{ status: "pending", limit: 5, offset: 10 }]);
  assert.ok(applicationsResponseSchema.safeParse(result).success);
  await listApplications({ address: ADMIN }, {});
  assert.deepEqual(asked[1], {
    status: undefined,
    limit: undefined,
    offset: 0,
  });
});

test("listing applications is admin only and validates the status", async () => {
  await assert.rejects(listApplications({ address: APPLICANT }, {}), {
    status: 403,
  });
  await assert.rejects(
    listApplications({ address: ADMIN }, { status: "open" }),
    { status: 400 },
  );
});

test("the pending saves schema accepts a confirmed draft", () => {
  assert.ok(
    pendingSavesResponseSchema.safeParse({
      saves: [
        {
          id: 1,
          batchId: "B1",
          detailsType: "farm",
          status: "confirmed",
          txHash: `0x${"a".repeat(64)}`,
          failureReason: null,
          payload: {},
          createdAt: "2026-11-09T10:00:00.000Z",
          resolvedAt: "2026-11-09T10:01:00.000Z",
        },
      ],
    }).success,
  );
});
