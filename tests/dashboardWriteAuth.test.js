// Auth gate for financial/CRM write routes on bmcDashboard.
// These previously accepted anonymous cookieless POSTs and appended Sheets rows.
// Run: node --test tests/dashboardWriteAuth.test.js

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";

process.env.API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || "dashboard-write-auth-test-token";
const TOKEN = process.env.API_AUTH_TOKEN;

const routerConfig = {
  bmcSheetId: "",
  bmcSheetSchema: "CRM_Operativo",
  bmcPagosSheetId: "",
  bmcVentasSheetId: "",
  anthropicApiKey: "",
  openaiApiKey: "",
  grokApiKey: "",
  geminiApiKey: "",
  apiAuthToken: TOKEN,
};

/** Write surfaces that must reject anonymous callers (requireCrmCockpitWrite). */
const WRITE_PROBES = [
  { method: "POST", path: "/api/pagos", body: { CLIENTE_NOMBRE: "auth-probe", MONTO: "1" } },
  { method: "PATCH", path: "/api/pagos/x", body: { ESTADO_PAGO: "Pendiente" } },
  { method: "POST", path: "/api/ventas", body: { CLIENTE: "auth-probe" } },
  { method: "POST", path: "/api/cotizaciones", body: { CLIENTE_NOMBRE: "auth-probe" } },
  { method: "PATCH", path: "/api/cotizaciones/x", body: { ESTADO: "Pendiente" } },
  { method: "POST", path: "/api/marcar-entregado", body: { cotizacionId: "x" } },
  { method: "PUT", path: "/api/productos-maestro/links", body: { links: { SKU: "COD" } } },
];

let server;
let baseUrl;

before(async () => {
  // Ensure requireServiceOrUser sees the token (reads server/config.js).
  const { config } = await import("../server/config.js");
  config.apiAuthToken = TOKEN;

  const { default: createBmcDashboardRouter } = await import("../server/routes/bmcDashboard.js");
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createBmcDashboardRouter(routerConfig));
  server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server?.close();
});

describe("dashboard financial/CRM writes require auth", () => {
  for (const probe of WRITE_PROBES) {
    it(`${probe.method} ${probe.path} without credentials → 401`, async () => {
      const res = await fetch(`${baseUrl}${probe.path}`, {
        method: probe.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(probe.body),
      });
      const body = await res.json().catch(() => ({}));
      assert.equal(res.status, 401, JSON.stringify(body));
      assert.equal(body.ok, false);
    });

    it(`${probe.method} ${probe.path} with x-api-key passes auth gate`, async () => {
      const res = await fetch(`${baseUrl}${probe.path}`, {
        method: probe.method,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": TOKEN,
        },
        body: JSON.stringify(probe.body),
      });
      // Auth must not 401. Downstream may 503 (no Sheets) / 400 / 501 / 200.
      assert.notEqual(res.status, 401, `unexpected 401 with valid token`);
      assert.notEqual(res.status, 403, `unexpected 403 with valid token`);
    });
  }
});
