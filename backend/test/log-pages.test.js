import test from "node:test";
import assert from "node:assert/strict";
import { blockRanges, readInPages } from "../src/chain/logPages.js";

test("blockRanges splits the span into pages, the last one shorter", () => {
  assert.deepEqual(blockRanges(0, 24, 10), [
    [0, 9],
    [10, 19],
    [20, 24],
  ]);
});

test("blockRanges covers a span smaller than one page in one request", () => {
  assert.deepEqual(blockRanges(5, 7, 10_000), [[5, 7]]);
});

test("blockRanges returns nothing when the start is past the end", () => {
  assert.deepEqual(blockRanges(10, 9, 100), []);
});

test("readInPages reads every page in order and joins the results", async () => {
  const asked = [];
  const logs = await readInPages(
    async (from, to) => {
      asked.push([from, to]);
      return [`${from}-${to}`];
    },
    { fromBlock: 100, toBlock: 120, pageSize: 10 },
  );

  assert.deepEqual(asked, [
    [100, 109],
    [110, 119],
    [120, 120],
  ]);
  assert.deepEqual(logs, ["100-109", "110-119", "120-120"]);
});

test("readInPages passes on a failure from the node", async () => {
  await assert.rejects(
    readInPages(
      async () => {
        throw new Error("block range too large");
      },
      { fromBlock: 0, toBlock: 5, pageSize: 10 },
    ),
    /block range too large/,
  );
});
