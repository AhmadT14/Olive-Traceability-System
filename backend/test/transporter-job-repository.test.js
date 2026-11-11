import test from "node:test";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { stubModule } from "./support/stubModule.js";

stubModule("db/db.js", [], { db: drizzle.mock() });
const repository =
  await import("../src/db/repositories/transporterJob.repository.js");

const offline = drizzle.mock();
const CALLER = "0xaaaa000000000000000000000000000000000001";

function fakeExec(rows) {
  const seen = {};
  const chain = {
    select: (columns) => {
      seen.columns = Object.keys(columns);
      return chain;
    },
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async (n) => {
      seen.limit = n;
      return rows;
    },
  };
  return { exec: chain, seen };
}

test("findClaimableForTransporter returns the best open job or null", async () => {
  const job = { id: 7, status: "reserved", transporter: CALLER };
  const found = fakeExec([job]);
  assert.deepEqual(
    await repository.findClaimableForTransporter("B1", CALLER, found.exec),
    job,
  );
  assert.deepEqual(found.seen, {
    columns: ["id", "status", "transporter"],
    limit: 1,
  });
  assert.equal(
    await repository.findClaimableForTransporter(
      "B1",
      CALLER,
      fakeExec([]).exec,
    ),
    null,
  );
});

test("findClaimableForTransporter looks only at open jobs and prefers the caller's reservation", async () => {
  const sqlOf = {
    select: (columns) => ({
      from: (table) => ({
        where: (where) => ({
          orderBy: (...order) => ({
            limit: async (n) => [
              offline
                .select(columns)
                .from(table)
                .where(where)
                .orderBy(...order)
                .limit(n)
                .toSQL(),
            ],
          }),
        }),
      }),
    }),
  };
  const { sql, params } = await repository.findClaimableForTransporter(
    "B1",
    CALLER,
    sqlOf,
  );
  assert.ok(sql.includes(`"transporter_jobs"."status" in ($2, $3)`), sql);
  assert.ok(
    sql.includes(
      `order by case when "transporter_jobs"."transporter" = $4 then 0 when "transporter_jobs"."status" = 'available' then 1 else 2 end`,
    ),
    sql,
  );
  assert.deepEqual(params, ["B1", "available", "reserved", CALLER, 1]);
});

test("releaseReservation only matches the caller's reserved job", () => {
  const { sql, params } = repository
    .releaseReservation(7, CALLER, offline)
    .toSQL();
  assert.ok(
    sql.includes(
      `where (("transporter_jobs"."id" = $5) and ("transporter_jobs"."status" = $6) and ("transporter_jobs"."transporter" = $7))`,
    ),
    sql,
  );
  assert.ok(sql.includes(`"reserve_tx_hash" = $3`), sql);
  assert.deepEqual(params, [
    null,
    "available",
    null,
    null,
    7,
    "reserved",
    CALLER,
  ]);
});

test("the job lists select reservedAt and mine=true includes reserved jobs", () => {
  const { sql, params } = repository
    .listActiveForTransporter(CALLER, offline)
    .toSQL();
  assert.match(sql, /"reserved_at"/);
  assert.deepEqual(params, [CALLER, "reserved", "claimed", "handover_pending"]);
  assert.match(repository.listAvailable(offline).toSQL().sql, /"reserved_at"/);
});
