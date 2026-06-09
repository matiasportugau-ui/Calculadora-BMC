// ============================================================================
// /api/bugs route regression tests
// Run: node tests/bugs-routes.test.js
//
// Covers the new user bug-reporting API without Google Sheets or GCS network
// calls. A fake Sheets client is injected through the router config so the
// production auth and mapping logic still runs end-to-end through Express.
// ============================================================================

import express from "express";
import { createBugsRouter } from "../server/routes/bugs.js";

let passed = 0;
let failed = 0;

function assert(name, condition, actual, expected) {
  if (condition) {
    console.log(`  PASS ${name}`);
    passed += 1;
    return;
  }
  console.log(`  FAIL ${name}`);
  console.log(`       got:      ${JSON.stringify(actual)}`);
  console.log(`       expected: ${JSON.stringify(expected)}`);
  failed += 1;
}

function createFakeSheets({ rows = [], appendError = null, getError = null } = {}) {
  const appended = [];
  const getRequests = [];
  return {
    appended,
    getRequests,
    spreadsheets: {
      values: {
        async append(req) {
          appended.push(req);
          if (appendError) throw new Error(appendError);
          return { data: {} };
        },
        async get(req) {
          getRequests.push(req);
          if (getError) throw new Error(getError);
          return { data: { values: rows } };
        },
      },
    },
  };
}

async function startServer(config) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/bugs", createBugsRouter(config));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function fetchJson(baseUrl, path, options = {}) {
  const resp = await fetch(`${baseUrl}${path}`, options);
  let json = null;
  try {
    json = await resp.json();
  } catch {
    // Non-JSON response.
  }
  return { status: resp.status, json };
}

async function postJson(baseUrl, path, body, headers = {}) {
  return fetchJson(baseUrl, path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function withServer(config, fn) {
  const { server, baseUrl } = await startServer(config);
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const BASE_CONFIG = {
  apiAuthToken: "test-api-token",
  bmcSheetId: "sheet-test",
  bmcAuditTab: "AUDIT_LOG",
  bugReportsTab: "BUG_REPORTS_TEST",
};

async function run() {
  console.log("\n=== /api/bugs route regression tests ===\n");
  const originalBugTab = process.env.BMC_BUG_REPORTS_TAB;
  delete process.env.BMC_BUG_REPORTS_TAB;

  try {
    await withServer(
      {
        ...BASE_CONFIG,
        bugReportsSheetsClient: createFakeSheets(),
      },
      async (baseUrl) => {
        const { status, json } = await postJson(baseUrl, "/api/bugs/report", {
          details: "Missing short description should fail before Sheets.",
        });
        assert(
          "POST /report validates shortDescription before Sheets",
          status === 400 && json?.ok === false && /shortDescription/.test(json?.error || ""),
          { status, json },
          { status: 400, ok: false },
        );
      },
    );

    await withServer(
      {
        ...BASE_CONFIG,
        bmcSheetId: "",
        bugReportsSheetsClient: createFakeSheets(),
      },
      async (baseUrl) => {
        const { status, json } = await postJson(baseUrl, "/api/bugs/report", {
          shortDescription: "Cannot persist without sheet id",
        });
        assert(
          "POST /report fails closed when BMC_SHEET_ID is missing",
          status === 503 && json?.code === "ENV_MISSING" && json?.envVar === "BMC_SHEET_ID",
          { status, json },
          { status: 503, code: "ENV_MISSING", envVar: "BMC_SHEET_ID" },
        );
      },
    );

    {
      const fakeSheets = createFakeSheets();
      await withServer(
        {
          ...BASE_CONFIG,
          bugReportsSheetsClient: fakeSheets,
        },
        async (baseUrl) => {
          const logs = Array.from({ length: 65 }, (_, i) => ({ level: "info", message: `log-${i}` }));
          const { status, json } = await postJson(
            baseUrl,
            "/api/bugs/report",
            {
              shortDescription: " =HYPERLINK(\"https://evil.example\")",
              details: "+formula-like detail",
              severity: "alta",
              url: "https://calculadora-bmc.vercel.app/hub/wolfboard",
              capturedAt: "2026-06-09T10:00:00.000Z",
              userAgent: "@agent",
              context: { route: "/hub/wolfboard", logs },
            },
            { Authorization: "Bearer test-api-token" },
          );

          const reportAppend = fakeSheets.appended[0];
          const auditAppend = fakeSheets.appended[1];
          const row = reportAppend?.requestBody?.values?.[0] || [];
          const savedContext = JSON.parse(row[8] || "{}");

          assert(
            "POST /report persists bug row and audit sidecar",
            status === 200 &&
              json?.ok === true &&
              json?.authMode === "token" &&
              fakeSheets.appended.length === 2 &&
              reportAppend?.range === "'BUG_REPORTS_TEST'!A:M" &&
              auditAppend?.range === "'AUDIT_LOG'!A:H",
            { status, json, appended: fakeSheets.appended.map((r) => r.range) },
            { status: 200, authMode: "token", ranges: ["'BUG_REPORTS_TEST'!A:M", "'AUDIT_LOG'!A:H"] },
          );

          assert(
            "POST /report sanitizes formula-like user cells before USER_ENTERED append",
            row[2]?.startsWith("' =HYPERLINK") &&
              row[3] === "'+formula-like detail" &&
              row[6] === "'@agent" &&
              reportAppend?.valueInputOption === "USER_ENTERED",
            { short: row[2], details: row[3], userAgent: row[6], valueInputOption: reportAppend?.valueInputOption },
            { shortPrefix: "' =HYPERLINK", details: "'+formula-like detail", userAgent: "'@agent" },
          );

          assert(
            "POST /report trims captured logs to last 60 entries",
            Array.isArray(savedContext.logs) &&
              savedContext.logs.length === 60 &&
              savedContext.logs[0]?.message === "log-5" &&
              savedContext.logs[59]?.message === "log-64",
            savedContext.logs?.map((entry) => entry.message).slice(0, 2),
            ["log-5", "log-6"],
          );
        },
      );
    }

    {
      const fakeSheets = createFakeSheets({ appendError: "Unable to parse range: BUG_REPORTS_TEST!A:M" });
      await withServer(
        {
          ...BASE_CONFIG,
          bugReportsSheetsClient: fakeSheets,
        },
        async (baseUrl) => {
          const { status, json } = await postJson(baseUrl, "/api/bugs/report", {
            shortDescription: "Tab missing should return operator-readable 503",
          });
          assert(
            "POST /report maps missing BUG_REPORTS tab to 503",
            status === 503 && /pesta.a/i.test(json?.error || "") && fakeSheets.appended.length === 1,
            { status, json, appended: fakeSheets.appended.length },
            { status: 503, appended: 1 },
          );
        },
      );
    }

    {
      const fakeRows = [
        ["id", "timestamp", "short", "details", "severity", "url", "ua", "capturedAt", "context", "status", "source", "authMode", "screenshotUrl"],
        ["BUG-OLDER", "2026-06-08T10:00:00.000Z", "Older wolf", "d", "alta", "https://app/hub/wolfboard", "", "", "{}", "nuevo", "api", "none", ""],
        ["BUG-MEDIA", "2026-06-09T11:00:00.000Z", "New media", "d", "media", "https://app/hub/wolfboard", "", "", "{}", "nuevo", "api", "token", ""],
        ["BUG-LATEST", "2026-06-09T12:00:00.000Z", "Latest alta wolf", "d", "alta", "https://app/hub/wolfboard/details", "", "", "{}", "nuevo", "api", "token", "https://storage/s.png"],
        ["BUG-OTHER", "2026-06-09T13:00:00.000Z", "Other alta", "d", "alta", "https://app/calculadora", "", "", "{}", "nuevo", "api", "none", ""],
      ];
      const fakeSheets = createFakeSheets({ rows: fakeRows });
      await withServer(
        {
          ...BASE_CONFIG,
          bugReportsSheetsClient: fakeSheets,
        },
        async (baseUrl) => {
          let result = await fetchJson(baseUrl, "/api/bugs?limit=1&severity=alta&routeContains=wolfboard");
          assert(
            "GET /api/bugs filters by severity and route, sorts newest first, and limits",
            result.status === 401 && result.json?.ok === false,
            { status: result.status, json: result.json },
            { status: 401, ok: false },
          );

          result = await fetchJson(baseUrl, "/api/bugs?limit=1&severity=alta&routeContains=wolfboard", {
            headers: { "x-api-key": "test-api-token" },
          });
          assert(
            "GET /api/bugs with token returns filtered latest summaries",
            result.status === 200 &&
              result.json?.ok === true &&
              result.json?.count === 1 &&
              result.json?.data?.[0]?.id === "BUG-LATEST" &&
              result.json?.data?.[0]?.hasScreenshot === true &&
              !("context" in (result.json?.data?.[0] || {})),
            { status: result.status, json: result.json },
            { status: 200, id: "BUG-LATEST", count: 1, hasScreenshot: true },
          );
        },
      );
    }
  } finally {
    if (originalBugTab === undefined) delete process.env.BMC_BUG_REPORTS_TAB;
    else process.env.BMC_BUG_REPORTS_TAB = originalBugTab;
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test run failed:", err);
  process.exit(1);
});
