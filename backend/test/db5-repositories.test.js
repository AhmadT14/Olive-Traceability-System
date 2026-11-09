import test from "node:test";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { stubModule } from "./support/stubModule.js";

stubModule("db/db.js", [], { db: drizzle.mock() });
const applications =
  await import("../src/repositories/registrationApplication.repository.js");
const pendingSaves =
  await import("../src/repositories/pendingSave.repository.js");
const chainEvents =
  await import("../src/repositories/chainEvent.repository.js");

const offline = drizzle.mock();
const WALLET = "0xaaaa000000000000000000000000000000000001";
const ADMIN = "0xbbbb000000000000000000000000000000000002";
const HASH = `0x${"c".repeat(64)}`;
const TX = `0x${"d".repeat(64)}`;

test("a new application is always stored as pending", () => {
  const { sql, params } = applications
    .insert(
      { walletAddress: WALLET, role: "FARMER", profile: { name: "Farm" } },
      offline,
    )
    .toSQL();
  assert.ok(sql.startsWith(`insert into "registration_applications"`), sql);
  assert.ok(params.includes("pending"));
  assert.ok(sql.endsWith("returning *") || sql.includes("returning"), sql);
});

test("an application is resolved only while it is pending", () => {
  const { sql, params } = applications
    .resolve(
      3,
      { status: "rejected", reviewedBy: ADMIN, rejectionReason: "unknown" },
      offline,
    )
    .toSQL();
  assert.ok(sql.includes(`"reviewed_at" = now()`), sql);
  assert.ok(
    sql.includes(
      `where ("registration_applications"."id" = $4 and "registration_applications"."status" = $5)`,
    ) ||
      sql.includes(
        `where (("registration_applications"."id" = $4) and ("registration_applications"."status" = $5))`,
      ),
    sql,
  );
  assert.deepEqual(params, ["rejected", "unknown", ADMIN, 3, "pending"]);
});

test("the application list filters by status and pages", () => {
  const filtered = applications
    .list({ status: "pending", limit: 10, offset: 20 }, offline)
    .toSQL();
  assert.ok(filtered.sql.includes(`"status" = $1`), filtered.sql);
  assert.ok(filtered.sql.includes("limit $2 offset $3"), filtered.sql);
  assert.deepEqual(filtered.params, ["pending", 10, 20]);
  const all = applications.list({}, offline).toSQL();
  assert.equal(all.sql.includes("where"), false, all.sql);
  assert.equal(all.sql.includes("limit"), false, all.sql);
  assert.ok(
    applications
      .findLatestByWallet(WALLET, offline)
      .toSQL()
      .sql.includes(`order by "registration_applications"."created_at" desc`),
  );
});

test("a pending save takes its tx hash once, from its own wallet", () => {
  const { sql, params } = pendingSaves
    .attachTxHash(5, WALLET, TX, offline)
    .toSQL();
  assert.ok(sql.includes(`"tx_hash" is null`), sql);
  assert.deepEqual(params, [TX, 5, WALLET, "pending"]);
});

test("the reconciler finds a pending save by batch and data hash", () => {
  const { sql, params } = pendingSaves
    .findPendingByBatchAndHash("B1", HASH, offline)
    .toSQL();
  assert.ok(sql.includes(`order by "pending_saves"."created_at" asc`), sql);
  assert.deepEqual(params, ["B1", HASH, "pending", 1]);
  assert.deepEqual(pendingSaves.listPending(50, offline).toSQL().params, [
    "pending",
    50,
  ]);
});

test("a pending save is resolved once and can record the tx hash", () => {
  const confirmed = pendingSaves
    .resolve(5, { status: "confirmed", txHash: TX }, offline)
    .toSQL();
  assert.ok(confirmed.sql.includes(`"resolved_at" = now()`), confirmed.sql);
  assert.ok(confirmed.params.includes(TX));
  assert.deepEqual(confirmed.params.slice(-2), [5, "pending"]);
  const failed = pendingSaves
    .resolve(6, { status: "failed", failureReason: "reverted" }, offline)
    .toSQL();
  assert.equal(failed.sql.includes(`"tx_hash"`), false, failed.sql);
  assert.deepEqual(failed.params, ["failed", "reverted", 6, "pending"]);
  const mine = pendingSaves
    .listForWallet(WALLET, { limit: 5 }, offline)
    .toSQL();
  assert.deepEqual(mine.params, [WALLET, 5]);
});

test("indexing the same chain event twice is a no-op", async () => {
  const { sql } = chainEvents
    .insertMany(
      [
        {
          contractAddress: WALLET,
          eventName: "BatchListed",
          txHash: TX,
          logIndex: 0,
          blockNumber: 12,
          batchTopic: HASH,
          addresses: [WALLET],
          args: {},
        },
      ],
      offline,
    )
    .toSQL();
  assert.ok(
    sql.includes(`on conflict ("tx_hash","log_index") do nothing`),
    sql,
  );
  assert.deepEqual(await chainEvents.insertMany([], offline), []);
});

test("event index reads use the batch topic or a participant address", () => {
  const byBatch = chainEvents.listByBatchTopic(HASH, offline).toSQL();
  assert.ok(
    byBatch.sql.includes(
      `order by "chain_events"."block_number" asc, "chain_events"."log_index" asc`,
    ),
    byBatch.sql,
  );
  const received = chainEvents
    .listByEventAndAddress("ReceiptConfirmed", WALLET, { limit: 10 }, offline)
    .toSQL();
  assert.ok(
    received.sql.includes(`"chain_events"."addresses" @>`),
    received.sql,
  );
  assert.equal(received.params[0], "ReceiptConfirmed");
});

test("the sync cursor is upserted by name", () => {
  const { sql, params } = chainEvents
    .setCursor("custody", 120, offline)
    .toSQL();
  assert.ok(sql.includes(`on conflict ("name") do update set`), sql);
  assert.deepEqual(params.slice(0, 2), ["custody", 120]);
});

test("getCursor returns null before the first sync", async () => {
  const exec = {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    }),
  };
  assert.equal(await chainEvents.getCursor("custody", exec), null);
});

test("pending saves and applications are looked up by their keys", () => {
  const draft = pendingSaves
    .insert(
      {
        walletAddress: WALLET,
        batchId: "B1",
        detailsType: "farm",
        payload: { harvest_date: "2026-10-01" },
        dataHash: HASH,
      },
      offline,
    )
    .toSQL();
  assert.ok(draft.sql.startsWith(`insert into "pending_saves"`), draft.sql);
  assert.ok(draft.params.includes("pending"));
  assert.deepEqual(pendingSaves.findByTxHash(TX, offline).toSQL().params, [
    TX,
    1,
  ]);
  assert.deepEqual(applications.findById(3, offline).toSQL().params, [3, 1]);
});
