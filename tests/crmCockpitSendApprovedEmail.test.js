// Regression coverage for CRM cockpit Email send-approved.
// Run: node tests/crmCockpitSendApprovedEmail.test.js
//
// PR #611 fixed the legacy cockpit path so Gmail replies leave from the
// receiving casilla's verified send-as alias. The lower-level mailer already
// supports `from`; this route test proves the cockpit passes it through.

import express from "express";
import assert from "node:assert/strict";

process.env.API_AUTH_TOKEN = "test-crm-cockpit-send-approved-token";

const { config: serverConfig } = await import("../server/config.js");
serverConfig.apiAuthToken = process.env.API_AUTH_TOKEN;

const { default: createBmcDashboardRouter } = await import("../server/routes/bmcDashboard.js");

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✅ ${label}`);
  } catch (err) {
    failed += 1;
    console.error(`  ❌ ${label}`);
    console.error(`     ${err.message}`);
  }
}

function makeApprovedEmailRow() {
  const row = Array(37).fill("");
  row[3] = "fallback@example.com"; // D telefono/contacto fallback
  row[5] = "Email"; // F origen
  row[31] = "Respuesta aprobada al cliente"; // AF respuestaSugerida
  row[34] = "Sí"; // AI aprobadoEnviar
  row[35] = ""; // AJ enviadoEl
  row[36] = "No"; // AK bloquearAuto
  return row;
}

async function run() {
  console.log("\n═══ CRM cockpit send-approved Email regression ═══");

  const updates = [];
  let capturedEmail = null;
  let capturedPoolUrl = null;
  let capturedLookupRow = null;

  const fakeSheets = {
    spreadsheets: {
      values: {
        get: async ({ spreadsheetId, range }) => {
          assert.equal(spreadsheetId, "sheet-test");
          assert.equal(range, "'CRM_Operativo'!A7:AK7");
          return { data: { values: [makeApprovedEmailRow()] } };
        },
        update: async (args) => {
          updates.push(args);
          return { data: { updatedRows: 1 } };
        },
      },
    },
  };

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", createBmcDashboardRouter(
    {
      bmcSheetId: "sheet-test",
      bmcSheetSchema: "CRM_Operativo",
      databaseUrl: "postgres://db.example.test/bmc",
      emailReplyDefaultCasilla: "fallback@bmcuruguay.com.uy",
      port: 0,
    },
    {
      checkSheetsAvailable: () => true,
      getCrmSheetsWrite: async () => fakeSheets,
      getEmailIngestPool: (databaseUrl) => {
        capturedPoolUrl = databaseUrl;
        return { kind: "fake-pool" };
      },
      getIngestByRow: async (pool, row) => {
        assert.deepEqual(pool, { kind: "fake-pool" });
        capturedLookupRow = row;
        return {
          account: "sarias@bmcuruguay.com.uy",
          remitente: "Cliente Test <cliente@example.com>",
          message_id: "<original-message@example.test>",
        };
      },
      sendEmailReply: async (args) => {
        capturedEmail = args;
        return { ok: true, transport: "gmail", messageId: "gmail-1" };
      },
    },
  ));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const res = await fetch(`${baseUrl}/api/crm/cockpit/send-approved`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_AUTH_TOKEN,
      },
      body: JSON.stringify({ row: 7 }),
    });
    const json = await res.json();

    check("route returns ok email response", () => {
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
      assert.equal(json.channel, "email");
      assert.equal(json.to, "cliente@example.com");
      assert.equal(json.casilla, "sarias@bmcuruguay.com.uy");
    });

    check("ingest metadata is looked up by CRM row", () => {
      assert.equal(capturedPoolUrl, "postgres://db.example.test/bmc");
      assert.equal(capturedLookupRow, 7);
    });

    check("mailer receives receiving casilla as account and Gmail send-as from", () => {
      assert.equal(capturedEmail.account, "sarias@bmcuruguay.com.uy");
      assert.equal(capturedEmail.from, "sarias@bmcuruguay.com.uy");
      assert.equal(capturedEmail.to, "cliente@example.com");
      assert.equal(capturedEmail.text, "Respuesta aprobada al cliente");
      assert.equal(capturedEmail.inReplyTo, "<original-message@example.test>");
      assert.match(capturedEmail.subject, /^Re:/);
    });

    check("send-approved stamps Enviado el after successful email send", () => {
      assert.equal(updates.length, 1);
      assert.equal(updates[0].spreadsheetId, "sheet-test");
      assert.equal(updates[0].range, "'CRM_Operativo'!AJ7");
      assert.equal(updates[0].valueInputOption, "USER_ENTERED");
      assert.match(updates[0].requestBody.values[0][0], /^\d{4}-\d{2}-\d{2}T/);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n${failed === 0 ? "✅" : "❌"} crmCockpitSendApprovedEmail: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test run failed:", err);
  process.exit(1);
});
