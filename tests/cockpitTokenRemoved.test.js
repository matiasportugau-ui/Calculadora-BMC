// S5 Phase B PR3 — GET /api/crm/cockpit-token removed (browser leak endpoint).
// Run: node --test tests/cockpitTokenRemoved.test.js

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";

const routerConfig = {
  bmcSheetId: "",
  bmcSheetSchema: "Master_Cotizaciones",
  anthropicApiKey: "",
  openaiApiKey: "",
  grokApiKey: "",
  geminiApiKey: "",
  apiAuthToken: "static_test_token",
};

let server;
let baseUrl;

before(async () => {
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

describe("cockpit-token endpoint removed", () => {
  it("GET /api/crm/cockpit-token returns 404", async () => {
    const res = await fetch(`${baseUrl}/api/crm/cockpit-token`, {
      headers: { Origin: "https://calculadora-bmc.vercel.app" },
    });
    assert.equal(res.status, 404);
  });
});