// S5 Phase B PR4 — /crm/cockpit/send-approved maps outbound failures to 502
// and Sheets write failures to 503.
// Run: node --test tests/crmCockpitSendApprovedStatus.test.js

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const config = {
  bmcSheetId: "sheet-test",
  bmcSheetSchema: "CRM_Operativo",
  apiAuthToken: "",
  googleApplicationCredentials: "",
  publicBaseUrl: "http://127.0.0.1:0",
  whatsappAccessToken: "wa-token",
  whatsappPhoneNumberId: "wa-phone-id",
  databaseUrl: "sqlite::memory:",
};

function makeRow(origen, withQuestion = true) {
  const v = new Array(40).fill("");
  v[2] = "Cliente";
  v[3] = "59899111222";
  v[5] = origen;
  v[6] = "Hola";
  v[22] = withQuestion ? "Q:123" : "";
  v[31] = "Respuesta";
  v[34] = "Sí";
  return v;
}

function makeSheets({ updateThrows = false, origen = "WA", withQuestion = true } = {}) {
  return {
    spreadsheets: {
      values: {
        get: async () => ({ data: { values: [makeRow(origen, withQuestion)] } }),
        update: async () => {
          if (updateThrows) throw new Error("sheet write failed");
          return { data: {} };
        },
      },
    },
  };
}

let credsPath;

before(async () => {
  credsPath = path.join(os.tmpdir(), `bmc-test-creds-${Date.now()}.json`);
  fs.writeFileSync(credsPath, "{}");
  config.googleApplicationCredentials = credsPath;
  const { config: loadedConfig } = await import("../server/config.js");
  config.apiAuthToken = loadedConfig.apiAuthToken;
});

after(() => {
  if (credsPath && fs.existsSync(credsPath)) fs.unlinkSync(credsPath);
});

describe("/crm/cockpit/send-approved status mapping", () => {
  it("returns 502 when WhatsApp send fails", async () => {
    const { default: createBmcDashboardRouter } = await import("../server/routes/bmcDashboard.js");
    const app = express();
    app.use(express.json({ limit: "1mb" }));
    app.use(
      "/api",
      createBmcDashboardRouter(config, {
        getCrmSheetsWrite: async () => makeSheets({ origen: "WA", withQuestion: false }),
        sendWhatsAppText: async () => {
          throw new Error("wa failed");
        },
        mirrorMlSendApprovedToOmni: async () => {},
      }),
    );
    const s = await new Promise((resolve) => {
      const srv = app.listen(0, "127.0.0.1", () => resolve(srv));
    });
    const url = `http://127.0.0.1:${s.address().port}/api/crm/cockpit/send-approved`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-api-key": config.apiAuthToken, "content-type": "application/json" },
      body: JSON.stringify({ row: 4 }),
    });
    assert.equal(res.status, 502);
    await new Promise((resolve) => s.close(resolve));
  });

  it("returns 503 when the WhatsApp branch cannot stamp Sheets", async () => {
    const { default: createBmcDashboardRouter } = await import("../server/routes/bmcDashboard.js");
    const app = express();
    app.use(express.json({ limit: "1mb" }));
    app.use(
      "/api",
      createBmcDashboardRouter(config, {
        getCrmSheetsWrite: async () => makeSheets({ updateThrows: true, origen: "WA", withQuestion: false }),
        sendWhatsAppText: async () => ({ messages: [{ id: "wa-1" }] }),
        mirrorMlSendApprovedToOmni: async () => {},
      }),
    );
    const s = await new Promise((resolve) => {
      const srv = app.listen(0, "127.0.0.1", () => resolve(srv));
    });
    const url = `http://127.0.0.1:${s.address().port}/api/crm/cockpit/send-approved`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-api-key": config.apiAuthToken, "content-type": "application/json" },
      body: JSON.stringify({ row: 4 }),
    });
    assert.equal(res.status, 503);
    await new Promise((resolve) => s.close(resolve));
  });

  it("returns 503 when the ML branch cannot stamp Sheets", async () => {
    const { default: createBmcDashboardRouter } = await import("../server/routes/bmcDashboard.js");
    const app = express();
    app.use(express.json({ limit: "1mb" }));
    app.use(
      "/api",
      createBmcDashboardRouter(
        { ...config, publicBaseUrl: "http://127.0.0.1:12345" },
        {
          getCrmSheetsWrite: async () => makeSheets({ updateThrows: true, origen: "ML" }),
          fetch: async () => ({
            ok: true,
            json: async () => ({ ok: true }),
          }),
          mirrorMlSendApprovedToOmni: async () => {},
        },
      ),
    );
    const s = await new Promise((resolve) => {
      const srv = app.listen(0, "127.0.0.1", () => resolve(srv));
    });
    const url = `http://127.0.0.1:${s.address().port}/api/crm/cockpit/send-approved`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-api-key": config.apiAuthToken, "content-type": "application/json" },
      body: JSON.stringify({ row: 4 }),
    });
    assert.equal(res.status, 503);
    await new Promise((resolve) => s.close(resolve));
  });
});
