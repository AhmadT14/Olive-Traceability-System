import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { stubModule, stubReader } from "./support/stubModule.js";

const reader = stubReader();
const applications = stubModule(
  "repositories/registrationApplication.repository.js",
  ["insert", "findById", "resolve"],
);
const admin = stubModule("services/admin.service.js", [
  "prepareRoleChange",
  "confirmRoleChange",
]);

const {
  approveApplication,
  prepareApproval,
  rejectApplication,
  submitApplication,
} = await import("../src/services/signup.service.js");

const APPLICANT = "0xAAAA000000000000000000000000000000000001";
const ADMIN = "0xBBBB000000000000000000000000000000000002";
const TX = `0x${"1".repeat(64)}`;
const CREATED = new Date(Date.UTC(2026, 10, 9));
const profile = { name: "Olive Grove", location: "Jenin" };

const row = (overrides = {}) => ({
  id: 4,
  walletAddress: APPLICANT.toLowerCase(),
  role: "FARMER",
  status: "pending",
  profile,
  rejectionReason: null,
  reviewedBy: null,
  createdAt: CREATED,
  reviewedAt: null,
  ...overrides,
});

let calls;
let stored;
beforeEach(() => {
  calls = [];
  stored = row();
  reader.hasAdminRole = async (address) => address === ADMIN;
  reader.hasRole = async () => false;
  applications.insert = async (values) => {
    calls.push(["insert", values]);
    return [row(values)];
  };
  applications.findById = async () => (stored ? [stored] : []);
  applications.resolve = async (id, review) => {
    calls.push(["resolve", id, review]);
    return [row({ ...review, reviewedAt: CREATED })];
  };
  admin.prepareRoleChange = async (user, body) => {
    calls.push(["prepareRoleChange", user.address, body]);
    return { ...body, transaction: {} };
  };
  admin.confirmRoleChange = async (user, body) => {
    calls.push(["confirmRoleChange", user.address, body]);
    return {};
  };
});

test("a wallet submits an application for a role", async () => {
  const { application } = await submitApplication(
    { address: APPLICANT },
    { role: "FARMER", profile },
  );

  assert.deepEqual(calls, [
    [
      "insert",
      { walletAddress: APPLICANT.toLowerCase(), role: "FARMER", profile },
    ],
  ]);
  assert.equal(application.status, "pending");
  assert.equal(application.address, APPLICANT.toLowerCase());
});

test("a wallet cannot apply for a role it already holds", async () => {
  reader.hasRole = async () => true;
  await assert.rejects(
    submitApplication({ address: APPLICANT }, { role: "FARMER", profile }),
    { status: 409, message: "wallet already has this role" },
  );
  assert.deepEqual(calls, []);
});

test("a second pending application from one wallet is a conflict", async () => {
  applications.insert = async () => {
    throw Object.assign(new Error("duplicate"), { code: "23505" });
  };
  await assert.rejects(
    submitApplication({ address: APPLICANT }, { role: "MILL", profile }),
    {
      status: 409,
      message: "an application is already pending for this wallet",
    },
  );
});

test("an application needs a role and a profile name", async () => {
  await assert.rejects(
    submitApplication({ address: APPLICANT }, { role: "ADMIN", profile: {} }),
    { status: 422 },
  );
});

test("only the admin can prepare an approval", async () => {
  await assert.rejects(prepareApproval({ address: APPLICANT }, "4"), {
    status: 403,
  });
  assert.deepEqual(calls, []);
});

test("the admin prepares the role grant for the applicant", async () => {
  await prepareApproval({ address: ADMIN }, "4");
  assert.deepEqual(calls, [
    [
      "prepareRoleChange",
      ADMIN,
      { address: APPLICANT.toLowerCase(), role: "FARMER", action: "register" },
    ],
  ]);
});

test("approving confirms the grant with the stored profile and closes the application", async () => {
  const { application } = await approveApplication({ address: ADMIN }, "4", {
    txHash: TX,
  });

  assert.deepEqual(calls, [
    [
      "confirmRoleChange",
      ADMIN,
      {
        address: APPLICANT.toLowerCase(),
        role: "FARMER",
        action: "register",
        txHash: TX,
        profile,
      },
    ],
    ["resolve", 4, { status: "approved", reviewedBy: ADMIN.toLowerCase() }],
  ]);
  assert.equal(application.status, "approved");
});

test("an application that is not pending cannot be approved", async () => {
  stored = row({ status: "rejected" });
  await assert.rejects(
    approveApplication({ address: ADMIN }, "4", { txHash: TX }),
    { status: 409, message: "application is already rejected" },
  );
  assert.deepEqual(calls, []);
});

test("a missing application is not found", async () => {
  stored = null;
  await assert.rejects(
    rejectApplication({ address: ADMIN }, "9", { reason: "no papers" }),
    { status: 404, message: "application not found" },
  );
});

test("the admin rejects an application with a reason", async () => {
  const { application } = await rejectApplication({ address: ADMIN }, "4", {
    reason: "no farm papers",
  });

  assert.deepEqual(calls, [
    [
      "resolve",
      4,
      {
        status: "rejected",
        reviewedBy: ADMIN.toLowerCase(),
        rejectionReason: "no farm papers",
      },
    ],
  ]);
  assert.equal(application.rejectionReason, "no farm papers");
});

test("an invalid application id is a bad request", async () => {
  await assert.rejects(
    rejectApplication({ address: ADMIN }, "abc", { reason: "x" }),
    { status: 400, message: "invalid application id" },
  );
});
