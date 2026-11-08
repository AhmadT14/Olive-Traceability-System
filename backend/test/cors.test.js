import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { allowOrigins, parseCorsOrigins } from "../src/api/cors.js";

const FRONTEND = "https://olive.example";

async function serve(origins) {
  const app = express();
  app.use(allowOrigins(origins));
  app.get("/ping", (req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((done) => server.close(done)) };
}

test("parseCorsOrigins reads a comma-separated list and ignores blanks", () => {
  assert.deepEqual(parseCorsOrigins(undefined), []);
  assert.deepEqual(parseCorsOrigins(""), []);
  assert.deepEqual(parseCorsOrigins(` ${FRONTEND} , http://localhost:5173,,`), [
    FRONTEND,
    "http://localhost:5173",
  ]);
});

test("allowOrigins answers the listed origin and no other", async () => {
  const { base, close } = await serve([FRONTEND]);
  try {
    const allowed = await fetch(`${base}/ping`, {
      headers: { Origin: FRONTEND },
    });
    assert.equal(allowed.headers.get("access-control-allow-origin"), FRONTEND);
    assert.match(
      allowed.headers.get("access-control-expose-headers"),
      /X-Request-Id/,
    );

    const other = await fetch(`${base}/ping`, {
      headers: { Origin: "https://evil.example" },
    });
    assert.equal(other.headers.get("access-control-allow-origin"), null);
  } finally {
    await close();
  }
});

test("allowOrigins answers a preflight for an authorized JSON request", async () => {
  const { base, close } = await serve([FRONTEND]);
  try {
    const preflight = await fetch(`${base}/ping`, {
      method: "OPTIONS",
      headers: {
        Origin: FRONTEND,
        "Access-Control-Request-Method": "PATCH",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("access-control-allow-origin"),
      FRONTEND,
    );
    assert.match(
      preflight.headers.get("access-control-allow-methods"),
      /PATCH/,
    );
    assert.match(
      preflight.headers.get("access-control-allow-headers"),
      /authorization/,
    );
  } finally {
    await close();
  }
});
