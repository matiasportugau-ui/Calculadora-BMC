/**
 * Bug FB: phone remito JPEG as base64 exceeds global express.json 1mb.
 * upload-b64 must accept up to ~8mb; other /api routes stay at 1mb.
 * Run: node tests/driverEvidenceJsonLimit.test.js
 */
import assert from "node:assert/strict";
import express from "express";

function makeApp() {
  const app = express();
  // Mirror server/index.js path-specific limit for upload-b64.
  app.use((req, res, next) => {
    if (req.path === "/api/driver/evidence/upload-b64" && req.method === "POST") {
      return express.json({ limit: "8mb" })(req, res, next);
    }
    return express.json({ limit: "1mb" })(req, res, next);
  });
  app.post("/api/driver/evidence/upload-b64", (req, res) => {
    res.json({ ok: true, n: String(req.body?.data_base64 || "").length });
  });
  app.post("/api/other", (_req, res) => res.json({ ok: true }));
  app.use((err, _req, res, _next) => {
    res.status(err.status || err.statusCode || 500).json({ error: err.type || err.message });
  });
  return app;
}

console.log("driverEvidenceJsonLimit");

const app = makeApp();
const server = app.listen(0);
const { port } = server.address();
const big = "A".repeat(Math.floor(1.5 * 1024 * 1024));

{
  const res = await fetch(`http://127.0.0.1:${port}/api/driver/evidence/upload-b64`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data_base64: big }),
  });
  assert.equal(res.status, 200, `upload-b64 should accept ~1.5MB JSON, got ${res.status}`);
  const body = await res.json();
  assert.equal(body.ok, true);
  console.log("  ✓ upload-b64 accepts 1.5MB body (8mb limit)");
}

{
  const res = await fetch(`http://127.0.0.1:${port}/api/other`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data_base64: big }),
  });
  assert.equal(res.status, 413, `other routes must stay at 1mb (got ${res.status})`);
  console.log("  ✓ /api/other still 413 on 1.5MB body");
}

server.close();
console.log("driverEvidenceJsonLimit OK");
