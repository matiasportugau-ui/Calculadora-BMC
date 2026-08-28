// Operator live board /api/storefront-live — auth + PII projection.
// #1163 shipped list/takeover/inject with only in-memory lib tests.
// Run: node tests/storefrontLiveRoutes.test.js

import http from "node:http";
import assert from "node:assert/strict";
import express from "express";

process.env.API_AUTH_TOKEN = "static_service_token_xyz";
process.env.APP_ENV = "test";
process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";

const { default: createStorefrontLiveRouter } = await import("../server/routes/storefrontLive.js");
const { config } = await import("../server/config.js");
const {
  pingLiveSession,
  __testLive__,
} = await import("../server/lib/voice/storefrontLive.js");

if (!config.apiAuthToken) config.apiAuthToken = process.env.API_AUTH_TOKEN;

__testLive__.reset();

const app = express();
app.use(express.json());
app.use("/api/storefront-live", createStorefrontLiveRouter());

const server = await new Promise((resolve, reject) => {
  const s = http.createServer(app);
  s.on("error", reject);
  s.listen(0, () => resolve(s));
});
const port = server.address().port;
const BASE = `http://127.0.0.1:${port}`;

async function req(path, { method = "GET", token, queryKey, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = new URL(`${BASE}${path}`);
  if (queryKey !== undefined) url.searchParams.set("key", queryKey);
  const r = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    json = null;
  }
  return { status: r.status, json };
}

await pingLiveSession({
  id: "live-http-1",
  cliente: "Ana",
  telefono: "099111222",
  pageUrl: "https://bmcuruguay.com.uy/products/iroof80-pls",
  adminRow: 12,
});

{
  const anonList = await req("/api/storefront-live");
  assert.equal(anonList.status, 401, "anonymous GET list → 401");
  assert.equal(anonList.json?.ok, false);

  const anonTake = await req("/api/storefront-live/live-http-1/takeover", { method: "POST" });
  assert.equal(anonTake.status, 401, "anonymous takeover → 401");

  const anonInj = await req("/api/storefront-live/live-http-1/inject", {
    method: "POST",
    body: { text: "hola" },
  });
  assert.equal(anonInj.status, 401, "anonymous inject → 401");
}

{
  const qs = await req("/api/storefront-live", { queryKey: process.env.API_AUTH_TOKEN });
  assert.equal(qs.status, 401, "?key= must not satisfy wolfboard auth");
}

{
  const listed = await req("/api/storefront-live", { token: process.env.API_AUTH_TOKEN });
  assert.equal(listed.status, 200, "static token lists sessions");
  assert.equal(listed.json?.ok, true);
  const item = (listed.json?.items || []).find((s) => s.id === "live-http-1");
  assert.ok(item, "session visible to operator");
  assert.equal(item.cliente, "Ana");
  const blob = JSON.stringify(item);
  assert.equal("phoneHash" in item, false, "list projection drops phoneHash");
  assert.equal("telefono" in item, false);
  assert.ok(!blob.includes("099111222"), "raw shopper phone never listed");
}

{
  const missing = await req("/api/storefront-live/does-not-exist", {
    token: process.env.API_AUTH_TOKEN,
  });
  assert.equal(missing.status, 404, "unknown session → 404");
}

{
  const one = await req("/api/storefront-live/live-http-1", { token: process.env.API_AUTH_TOKEN });
  assert.equal(one.status, 200);
  assert.equal(one.json?.item?.id, "live-http-1");
  assert.equal("phoneHash" in (one.json?.item || {}), false);
  assert.ok(!JSON.stringify(one.json).includes("099111222"));
}

{
  const empty = await req("/api/storefront-live/live-http-1/inject", {
    method: "POST",
    token: process.env.API_AUTH_TOKEN,
    body: { text: "   " },
  });
  assert.equal(empty.status, 400, "empty inject → 400");
  assert.match(String(empty.json?.error || ""), /texto/i);
}

{
  const take = await req("/api/storefront-live/live-http-1/takeover", {
    method: "POST",
    token: process.env.API_AUTH_TOKEN,
  });
  assert.equal(take.status, 200);
  assert.equal(take.json?.ok, true);
  assert.equal(take.json?.item?.status, "takeover");
}

{
  const inj = await req("/api/storefront-live/live-http-1/inject", {
    method: "POST",
    token: process.env.API_AUTH_TOKEN,
    body: { text: "Hola, soy de ventas BMC" },
  });
  assert.equal(inj.status, 200);
  assert.equal(inj.json?.ok, true);
}

__testLive__.reset();
await new Promise((resolve) => server.close(resolve));
console.log("storefrontLiveRoutes.test.js ok");
