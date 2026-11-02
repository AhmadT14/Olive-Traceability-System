import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import helmet from "helmet";
import { authRateLimit, requestId } from "../src/api/security.js";

async function serve(configure) {
  const app = express();
  configure(app);
  app.get("/ping", (req, res) => res.json({ id: req.id }));
  const server = await new Promise((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((done) => server.close(done)) };
}

test("requestId gives each request an id and returns it in a header", async () => {
  const { base, close } = await serve((app) => app.use(requestId));
  try {
    const first = await fetch(`${base}/ping`);
    const second = await fetch(`${base}/ping`);
    const id = first.headers.get("x-request-id");

    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.equal((await first.json()).id, id);
    assert.notEqual(second.headers.get("x-request-id"), id);
  } finally {
    await close();
  }
});

test("requestId keeps a safe incoming id and replaces an unsafe one", async () => {
  const { base, close } = await serve((app) => app.use(requestId));
  try {
    const kept = await fetch(`${base}/ping`, {
      headers: { "X-Request-Id": "frontend-123" },
    });
    const replaced = await fetch(`${base}/ping`, {
      headers: { "X-Request-Id": "bad id <script>" },
    });

    assert.equal(kept.headers.get("x-request-id"), "frontend-123");
    assert.notEqual(replaced.headers.get("x-request-id"), "bad id <script>");
  } finally {
    await close();
  }
});

test("authRateLimit answers 429 in the API error shape after the limit", async () => {
  const { base, close } = await serve((app) =>
    app.use("/ping", authRateLimit({ limit: 2 })),
  );
  try {
    const statuses = [];
    for (let i = 0; i < 3; i += 1) {
      statuses.push((await fetch(`${base}/ping`)).status);
    }
    const blocked = await fetch(`${base}/ping`);

    assert.deepEqual(statuses, [200, 200, 429]);
    assert.deepEqual(await blocked.json(), {
      error: "too many requests; try again in a minute",
    });
    assert.ok(blocked.headers.get("ratelimit-policy"));
  } finally {
    await close();
  }
});

test("helmet adds the security headers", async () => {
  const { base, close } = await serve((app) => app.use(helmet()));
  try {
    const res = await fetch(`${base}/ping`);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-powered-by"), null);
  } finally {
    await close();
  }
});
