import assert from "node:assert/strict";
import express from "express";
import { createBugsRouterWithDeps } from "../server/routes/bugs.js";

const BASE_CONFIG = {
  apiAuthToken: "test-bugs-token",
  bmcSheetId: "sheet-123",
  bmcAuditTab: "AUDIT_LOG",
  bugReportsTab: "BUG_REPORTS",
};

function makeFakeSheets({ values = [], appendImpl } = {}) {
  const calls = { append: [], get: [] };
  const sheets = {
    spreadsheets: {
      values: {
        append: async (args) => {
          calls.append.push(args);
          if (appendImpl) return appendImpl(args, calls.append.length);
          return { data: { updates: { updatedRows: 1 } } };
        },
        get: async (args) => {
          calls.get.push(args);
          return { data: { values } };
        },
      },
    },
  };
  return { sheets, calls };
}

function makeApp(config, deps) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/bugs", createBugsRouterWithDeps({ ...BASE_CONFIG, ...config }, deps));
  return app;
}

async function withServer(app, fn) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function testPostReportWritesSanitizedRows() {
  const logs = Array.from({ length: 65 }, (_, i) => ({ level: "info", message: `log-${i}` }));
  const { sheets, calls } = makeFakeSheets();
  const deps = {
    getSheets: async () => sheets,
    makeBugId: () => "BUG-TEST-1",
    nowIso: () => "2026-06-08T10:00:00.000Z",
    uploadBugScreenshotToGcs: async (dataUrl, filename, bucket) => {
      assert.equal(dataUrl, "data:image/jpeg;base64,abc");
      assert.equal(filename, "bug-BUG-TEST-1.jpg");
      assert.equal(bucket, "bug-screens");
      return "https://storage.example/bug-BUG-TEST-1.jpg";
    },
  };
  const app = makeApp({ gcsQuotesBucket: "bug-screens" }, deps);

  await withServer(app, async (base) => {
    const { response, body } = await jsonFetch(`${base}/api/bugs/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shortDescription: " =HYPERLINK(\"https://evil.example\")",
        details: "-dangerous details",
        severity: "alta",
        url: "@bad-url",
        userAgent: "\t=BadAgent",
        context: {
          route: "/wolfboard",
          logs,
          screenshotDataUrl: "data:image/jpeg;base64,abc",
        },
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      ok: true,
      id: "BUG-TEST-1",
      tab: "BUG_REPORTS",
      severity: "alta",
      authMode: "none",
    });
  });

  assert.equal(calls.append.length, 2, "bug report and audit sidecar should both append");
  const bugAppend = calls.append[0];
  assert.equal(bugAppend.spreadsheetId, "sheet-123");
  assert.equal(bugAppend.range, "'BUG_REPORTS'!A:M");
  assert.equal(bugAppend.valueInputOption, "USER_ENTERED");

  const row = bugAppend.requestBody.values[0];
  assert.equal(row[0], "BUG-TEST-1");
  assert.equal(row[1], "2026-06-08T10:00:00.000Z");
  assert.equal(row[2], "' =HYPERLINK(\"https://evil.example\")");
  assert.equal(row[3], "'-dangerous details");
  assert.equal(row[4], "alta");
  assert.equal(row[5], "'@bad-url");
  assert.equal(row[6], "'\t=BadAgent");
  assert.equal(row[9], "nuevo");
  assert.equal(row[10], "api/bugs/report");
  assert.equal(row[11], "none");
  assert.equal(row[12], "https://storage.example/bug-BUG-TEST-1.jpg");

  const storedContext = JSON.parse(row[8]);
  assert.equal(storedContext.screenshotUrl, "https://storage.example/bug-BUG-TEST-1.jpg");
  assert.equal(storedContext.screenshotDataUrl, undefined);
  assert.equal(storedContext.logs.length, 60, "context logs should be capped to the newest 60 entries");
  assert.equal(storedContext.logs[0].message, "log-5");
  assert.equal(storedContext.logs[59].message, "log-64");

  const auditRow = calls.append[1].requestBody.values[0];
  assert.equal(calls.append[1].range, "'AUDIT_LOG'!A:H");
  assert.equal(auditRow[1], "USER_BUG_REPORT");
  assert.equal(auditRow[2], "BUG-TEST-1");
  assert.equal(auditRow[7], "BUG_REPORTS");
}

async function testPostReportAuthModesAndValidation() {
  const { sheets, calls } = makeFakeSheets();
  const app = makeApp({}, {
    getSheets: async () => sheets,
    makeBugId: () => "BUG-AUTH",
    nowIso: () => "2026-06-08T10:01:00.000Z",
  });

  await withServer(app, async (base) => {
    let result = await jsonFetch(`${base}/api/bugs/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shortDescription: "   " }),
    });
    assert.equal(result.response.status, 400);
    assert.match(result.body.error, /shortDescription/);

    result = await jsonFetch(`${base}/api/bugs/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer test-bugs-token" },
      body: JSON.stringify({ shortDescription: "token report" }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.authMode, "token");

    result = await jsonFetch(`${base}/api/bugs/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer jwt-like-value" },
      body: JSON.stringify({ shortDescription: "jwt report" }),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.authMode, "jwt-or-other");
  });

  assert.equal(calls.append.length, 4, "only the two valid reports should append report + audit rows");
  assert.equal(calls.append[0].requestBody.values[0][11], "token");
  assert.equal(calls.append[2].requestBody.values[0][11], "jwt-or-other");
}

async function testPostReportMissingTabReturns503() {
  const { sheets, calls } = makeFakeSheets({
    appendImpl: async () => {
      throw new Error("Unable to parse range: BUG_REPORTS!A:M");
    },
  });
  const app = makeApp({}, {
    getSheets: async () => sheets,
    makeBugId: () => "BUG-MISSING-TAB",
    nowIso: () => "2026-06-08T10:02:00.000Z",
  });

  await withServer(app, async (base) => {
    const { response, body } = await jsonFetch(`${base}/api/bugs/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shortDescription: "cannot write" }),
    });
    assert.equal(response.status, 503);
    assert.match(body.error, /pestaña 'BUG_REPORTS' no existe/);
  });

  assert.equal(calls.append.length, 1, "audit sidecar must not run after report append fails");
}

async function testGetBugsAuthFilteringSortingAndLimit() {
  const rows = [
    ["id", "timestamp", "shortDescription", "details", "severity", "url", "userAgent", "capturedAt", "context", "status", "source", "authMode", "screenshotUrl"],
    ["BUG-OLD", "2026-06-08T09:00:00.000Z", "old", "details", "alta", "/wolfboard/old", "", "", "", "nuevo", "", "none", ""],
    ["BUG-NEW", "2026-06-08T10:00:00.000Z", "new", "details", "alta", "/wolfboard/new", "", "", "", "nuevo", "", "token", "https://shot/new.jpg"],
    ["BUG-MED", "2026-06-08T10:30:00.000Z", "medium", "details", "media", "/calc", "", "", "", "nuevo", "", "none", ""],
  ];
  const { sheets, calls } = makeFakeSheets({ values: rows });
  const app = makeApp({}, { getSheets: async () => sheets });

  await withServer(app, async (base) => {
    let result = await jsonFetch(`${base}/api/bugs`);
    assert.equal(result.response.status, 401);
    assert.equal(result.body.ok, false);

    result = await jsonFetch(`${base}/api/bugs?severity=alta&routeContains=wolfboard&limit=1`, {
      headers: { "x-api-key": "test-bugs-token" },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.count, 1);
    assert.equal(result.body.data[0].id, "BUG-NEW", "newest matching report should be first after sort");
    assert.equal(result.body.data[0].rowNum, 3);
    assert.equal(result.body.data[0].authMode, "token");
    assert.equal(result.body.data[0].hasScreenshot, true);
  });

  assert.equal(calls.get.length, 1, "unauthorized list should not read Sheets");
  assert.equal(calls.get[0].range, "'BUG_REPORTS'!A:M");
}

async function testGetBugsFailsClosedWithoutApiToken() {
  const { sheets, calls } = makeFakeSheets({ values: [] });
  const app = makeApp({ apiAuthToken: "" }, { getSheets: async () => sheets });

  await withServer(app, async (base) => {
    const { response, body } = await jsonFetch(`${base}/api/bugs`);
    assert.equal(response.status, 503);
    assert.equal(body.envVar, "API_AUTH_TOKEN");
  });

  assert.equal(calls.get.length, 0, "missing API token config should fail before Sheets read");
}

await testPostReportWritesSanitizedRows();
await testPostReportAuthModesAndValidation();
await testPostReportMissingTabReturns503();
await testGetBugsAuthFilteringSortingAndLimit();
await testGetBugsFailsClosedWithoutApiToken();

console.log("bugs-routes tests OK (5/5)");
