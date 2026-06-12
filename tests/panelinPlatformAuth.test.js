import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import createPanelinRouter from "../server/routes/panelin.js";

function startTestServer() {
  const app = express();
  app.use(express.json());
  app.use("/api/panelin", createPanelinRouter({ apiAuthToken: "panelin-test-token" }, console));

  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}/api/panelin` });
    });
  });
}

async function requestJson(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

test("Panelin platform routes reject anonymous access before DB work", async () => {
  const { server, base } = await startTestServer();
  try {
    for (const [method, path, body] of [
      ["GET", "/products", undefined],
      ["PATCH", "/products/PANEL-TEST", { cost_usd: 1 }],
      ["POST", "/stock/movements", { sku: "PANEL-TEST", delta: 1 }],
      ["POST", "/invoices", { external_id: "INV-TEST" }],
      ["POST", "/sync/facturaexpress/invoices", {}],
    ]) {
      const res = await requestJson(base, path, {
        method,
        body: body == null ? undefined : JSON.stringify(body),
      });
      assert.equal(res.status, 401, `${method} ${path}`);
      assert.equal(res.body.ok, false, `${method} ${path}`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Panelin platform routes keep service-token callers gated on DB availability", async () => {
  const { server, base } = await startTestServer();
  try {
    const res = await requestJson(base, "/status", {
      headers: { Authorization: "Bearer panelin-test-token" },
    });
    assert.equal(res.status, 503);
    assert.equal(res.body.error, "panelin_db_unavailable");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
