/**
 * Integration: shipped createRepartosRouter — create → put → confirm.
 * Requires DATABASE_URL + API_AUTH_TOKEN (e.g. doppler run --project bmc-backend --config prd).
 *
 * Run:
 *   doppler run --project bmc-backend --config prd -- node tests/repartos-api.integration.test.js
 *   node tests/repartos-api.integration.test.js   # skips if env missing
 */
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import createRepartosRouter from "../server/routes/repartos.js";

const databaseUrl = process.env.DATABASE_URL || "";
const apiAuthToken = process.env.API_AUTH_TOKEN || "";

function log(msg) {
  console.log(msg);
}

async function withServer(handler) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(
    "/api",
    createRepartosRouter(
      { databaseUrl, apiAuthToken },
      { info: (...a) => console.log("[repartos]", ...a) },
    ),
  );
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    return await handler(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  if (!databaseUrl || !apiAuthToken) {
    log("SKIP: DATABASE_URL or API_AUTH_TOKEN missing — pure unit tests still cover numbering/status");
    log(JSON.stringify({ skipped: true, hasDb: Boolean(databaseUrl), hasToken: Boolean(apiAuthToken) }));
    process.exit(0);
  }

  const out = await withServer(async (base) => {
    const auth = { Authorization: `Bearer ${apiAuthToken}`, "Content-Type": "application/json" };

    // health
    const hRes = await fetch(`${base}/api/repartos/health`);
    const health = await hRes.json();
    assert.equal(hRes.status, 200, "health status");
    assert.equal(health.ok, true, "health.ok");
    assert.ok(health.db === "ok" || health.db === true, "health.db");

    // create
    const createRes = await fetch(`${base}/api/repartos`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        deliveryDate: new Date().toISOString().slice(0, 10),
        truckL: 12,
        payload: {
          schema: "bmc-reparto-payload-v1",
          stops: [
            { id: "s1", cliente: "Alfredo Nario", orderId: "3102022", orden: 1 },
            { id: "s2", cliente: "Luis Gonzalez", orderId: "1344059", orden: 2 },
          ],
          truckL: 12,
        },
        actor: "integration-test",
      }),
    });
    const created = await createRes.json();
    assert.equal(createRes.status, 201, `create status ${createRes.status} ${JSON.stringify(created)}`);
    assert.equal(created.ok, true);
    assert.equal(created.reparto.status, "en_coordinacion");
    assert.match(created.reparto.repartoNo, /^REP-\d{4}-\d{2}-\d{2}-\d{3}$/);
    const { id, repartoNo } = created.reparto;

    // put (autosave)
    const putRes = await fetch(`${base}/api/repartos/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: auth,
      body: JSON.stringify({
        expectedRevision: created.reparto.revision || 1,
        truckL: 12,
        payload: {
          schema: "bmc-reparto-payload-v1",
          stops: [
            { id: "s1", cliente: "Alfredo Nario", orderId: "3102022", orden: 1 },
            { id: "s2", cliente: "Luis Gonzalez", orderId: "1344059", orden: 2 },
          ],
          truckL: 12,
          loadWarnings: [],
        },
      }),
    });
    const putBody = await putRes.json();
    assert.equal(putRes.status, 200, `put ${putRes.status} ${JSON.stringify(putBody)}`);
    assert.equal(putBody.status, "en_coordinacion");

    // confirm
    const confRes = await fetch(`${base}/api/repartos/${encodeURIComponent(id)}/confirm`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        actor: "integration-test",
        payload: {
          schema: "bmc-reparto-payload-v1",
          stops: [
            { id: "s1", cliente: "Alfredo Nario", orderId: "3102022", orden: 1 },
            { id: "s2", cliente: "Luis Gonzalez", orderId: "1344059", orden: 2 },
          ],
          truckL: 12,
        },
      }),
    });
    const confirmed = await confRes.json();
    assert.equal(confRes.status, 200, `confirm ${confRes.status} ${JSON.stringify(confirmed)}`);
    assert.equal(confirmed.ok, true);
    assert.equal(confirmed.reparto.status, "coordinado");
    assert.equal(confirmed.reparto.repartoNo, repartoNo);
    assert.ok(confirmed.reparto.drivePlan?.path, "drivePlan.path reserved");

    // Re-confirm must not overwrite immutable snapshot
    const reConfRes = await fetch(`${base}/api/repartos/${encodeURIComponent(id)}/confirm`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        actor: "integration-test-evil",
        payload: {
          schema: "bmc-reparto-payload-v1",
          stops: [{ id: "sX", cliente: "OVERWRITE", orderId: "999", orden: 1 }],
          truckL: 12,
        },
      }),
    });
    const reConf = await reConfRes.json();
    assert.equal(reConfRes.status, 409, `re-confirm must be 409, got ${reConfRes.status} ${JSON.stringify(reConf)}`);
    assert.equal(reConf.error, "immutable");

    // GET by id
    const getRes = await fetch(`${base}/api/repartos/${encodeURIComponent(repartoNo)}`, {
      headers: { Authorization: `Bearer ${apiAuthToken}` },
    });
    const got = await getRes.json();
    assert.equal(getRes.status, 200);
    assert.equal(got.reparto.status, "coordinado");
    assert.ok(Array.isArray(got.events) && got.events.some((e) => e.type === "coordination.confirmed"));
    // Original confirmed stops must remain (not OVERWRITE)
    const stopClients = (got.reparto.payload?.stops || []).map((s) => s.cliente);
    assert.ok(stopClients.includes("Alfredo Nario"), "snapshot preserved");
    assert.ok(!stopClients.includes("OVERWRITE"), "re-confirm must not mutate payload");

    // list
    const listRes = await fetch(`${base}/api/repartos?limit=5`, {
      headers: { Authorization: `Bearer ${apiAuthToken}` },
    });
    const list = await listRes.json();
    assert.equal(listRes.status, 200);
    assert.ok(list.repartos.some((r) => r.reparto_no === repartoNo || r.id === id));

    return {
      health,
      created: { status: created.reparto.status, repartoNo, id },
      confirmed: {
        status: confirmed.reparto.status,
        repartoNo: confirmed.reparto.repartoNo,
        drivePlan: confirmed.reparto.drivePlan,
      },
      eventsCount: got.events?.length,
      listHit: true,
    };
  });

  log("repartos-api.integration: PASS");
  log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
