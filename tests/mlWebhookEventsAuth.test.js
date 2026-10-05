/**
 * Regression: GET /webhooks/ml/events must not be anonymous.
 * The in-memory buffer holds full ML notification bodies (resource paths,
 * ids, buyer hints). Prod was returning 200 without auth.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

process.env.APP_ENV = "test";
process.env.API_AUTH_TOKEN = "ml-events-test-token";

const { requireServiceOrUser } = await import("../server/middleware/requireServiceOrUser.js");
const { createMlWebhookBuffer, buildMlWebhookEvent } = await import("../server/lib/mlWebhookService.js");

function listen(app) {
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        server,
        base: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

async function request(base, path, headers = {}) {
  const res = await fetch(`${base}${path}`, { headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  return { status: res.status, json, text };
}

describe("GET /webhooks/ml/events auth", () => {
  let ctx;
  const buffer = createMlWebhookBuffer(10);

  before(async () => {
    buffer.push(
      buildMlWebhookEvent({
        body: { resource: "/questions/999", topic: "questions", user_id: 42 },
        query: {},
        headers: { "x-request-id": "req-leak-test" },
      }),
    );
    const app = express();
    const requireMlAuth = requireServiceOrUser({ authOnly: true });
    app.get("/webhooks/ml/events", requireMlAuth, (_req, res) => {
      res.json({ ok: true, count: buffer.count(), events: buffer.list() });
    });
    ctx = await listen(app);
  });

  after(async () => {
    await ctx.close();
  });

  it("rejects anonymous callers", async () => {
    const res = await request(ctx.base, "/webhooks/ml/events");
    assert.equal(res.status, 401);
    assert.equal(res.json?.ok, false);
    assert.equal(res.json?.count, undefined);
    assert.equal(res.json?.events, undefined);
  });

  it("rejects wrong bearer", async () => {
    const res = await request(ctx.base, "/webhooks/ml/events", {
      Authorization: "Bearer wrong-token",
    });
    assert.equal(res.status, 401);
    assert.equal(res.json?.events, undefined);
  });

  it("returns buffered events with service token", async () => {
    const res = await request(ctx.base, "/webhooks/ml/events", {
      Authorization: "Bearer ml-events-test-token",
    });
    assert.equal(res.status, 200);
    assert.equal(res.json?.ok, true);
    assert.equal(res.json?.count, 1);
    assert.equal(res.json?.events?.[0]?.body?.resource, "/questions/999");
  });
});
