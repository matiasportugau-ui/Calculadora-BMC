// User bug reports route regression tests.
// Run: node --test tests/bugReportsRoutes.test.js

import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createBugsRouter } from "../server/routes/bugs.js";

const TOKEN = "bug-route-token";
const FIXED_NOW = "2026-06-12T10:15:00.000Z";
const FIXED_ID = "BUG-20260612-TEST";

let server;
let baseUrl;
let appendCalls;
let getCalls;
let getRows;
let uploadCalls;
let oldBugTab;

const fakeSheets = {
  spreadsheets: {
    values: {
      append: async (args) => {
        appendCalls.push(args);
        return { data: {} };
      },
      get: async (args) => {
        getCalls.push(args);
        return { data: { values: getRows } };
      },
    },
  },
};

before(async () => {
  oldBugTab = process.env.BMC_BUG_REPORTS_TAB;
  delete process.env.BMC_BUG_REPORTS_TAB;

  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(
    "/api/bugs",
    createBugsRouter(
      {
        apiAuthToken: TOKEN,
        bmcSheetId: "sheet-123",
        bmcAuditTab: "AUDIT_LOG",
        bugReportsTab: "BUG_REPORTS",
        gcsQuotesBucket: "bug-shots",
      },
      {
        getSheets: async () => fakeSheets,
        uploadBugScreenshotToGcs: async (dataUrl, filename, bucket) => {
          uploadCalls.push({ dataUrl, filename, bucket });
          return `https://storage.example/${filename}`;
        },
        makeBugId: () => FIXED_ID,
        nowIso: () => FIXED_NOW,
      },
    ),
  );

  server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  if (oldBugTab === undefined) {
    delete process.env.BMC_BUG_REPORTS_TAB;
  } else {
    process.env.BMC_BUG_REPORTS_TAB = oldBugTab;
  }
  server?.close();
});

beforeEach(() => {
  appendCalls = [];
  getCalls = [];
  getRows = [];
  uploadCalls = [];
});

describe("/api/bugs", () => {
  it("rejects empty reports before touching Sheets", async () => {
    const res = await fetch(`${baseUrl}/api/bugs/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shortDescription: "   " }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.match(body.error, /shortDescription/);
    assert.equal(appendCalls.length, 0);
  });

  it("accepts public reports, sanitizes Sheet cells, uploads screenshots, and writes audit sidecar", async () => {
    const logs = Array.from({ length: 65 }, (_, i) => ({ level: "info", message: `log-${i}` }));

    const res = await fetch(`${baseUrl}/api/bugs/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shortDescription: ' =HYPERLINK("https://evil.example")',
        details: "+formula-like details",
        severity: "alta",
        url: "/hub/wa?thread=123",
        capturedAt: "2026-06-12T10:14:00.000Z",
        userAgent: "Cursor test agent",
        context: {
          screenshotDataUrl: "data:image/jpeg;base64,abc123",
          logs,
          extra: { route: "/hub/wa" },
        },
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(
      { ok: body.ok, id: body.id, tab: body.tab, severity: body.severity, authMode: body.authMode },
      { ok: true, id: FIXED_ID, tab: "BUG_REPORTS", severity: "alta", authMode: "none" },
    );

    assert.equal(uploadCalls.length, 1);
    assert.deepEqual(uploadCalls[0], {
      dataUrl: "data:image/jpeg;base64,abc123",
      filename: `bug-${FIXED_ID}.jpg`,
      bucket: "bug-shots",
    });

    assert.equal(appendCalls.length, 2);
    assert.equal(appendCalls[0].spreadsheetId, "sheet-123");
    assert.equal(appendCalls[0].range, "'BUG_REPORTS'!A:M");
    assert.equal(appendCalls[1].range, "'AUDIT_LOG'!A:H");

    const row = appendCalls[0].requestBody.values[0];
    assert.equal(row[0], FIXED_ID);
    assert.equal(row[1], FIXED_NOW);
    assert.equal(row[2], '\' =HYPERLINK("https://evil.example")');
    assert.equal(row[3], "'+formula-like details");
    assert.equal(row[11], "none");
    assert.equal(row[12], `https://storage.example/bug-${FIXED_ID}.jpg`);

    const context = JSON.parse(row[8]);
    assert.equal(context.screenshotDataUrl, undefined);
    assert.equal(context.screenshotUrl, `https://storage.example/bug-${FIXED_ID}.jpg`);
    assert.equal(context.logs.length, 60);
    assert.equal(context.logs[0].message, "log-5");
  });

  it("protects the list endpoint and returns filtered recent summaries", async () => {
    getRows = [
      ["id", "timestamp", "shortDescription", "details", "severity", "url", "ua", "capturedAt", "context", "status", "source", "authMode", "screenshotUrl"],
      ["BUG-OLD", "2026-06-11T09:00:00.000Z", "old", "details", "media", "/hub/wa", "", "", "", "nuevo", "api", "none", ""],
      ["BUG-WA", "2026-06-12T10:00:00.000Z", "wa bug", "details", "alta", "/hub/wa?thread=1", "", "", "", "nuevo", "api", "token", "https://shot.example/wa.jpg"],
      ["BUG-ML", "2026-06-12T09:00:00.000Z", "ml bug", "details", "alta", "/hub/ml", "", "", "", "nuevo", "api", "token", ""],
    ];

    let res = await fetch(`${baseUrl}/api/bugs?severity=alta&routeContains=wa&limit=2`);
    assert.equal(res.status, 401);

    res = await fetch(`${baseUrl}/api/bugs?severity=alta&routeContains=wa&limit=2`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(getCalls.length, 1);
    assert.equal(getCalls[0].range, "'BUG_REPORTS'!A:M");
    assert.equal(body.ok, true);
    assert.equal(body.count, 1);
    assert.deepEqual(body.data[0], {
      rowNum: 3,
      id: "BUG-WA",
      timestamp: "2026-06-12T10:00:00.000Z",
      shortDescription: "wa bug",
      details: "details",
      severity: "alta",
      url: "/hub/wa?thread=1",
      authMode: "token",
      screenshotUrl: "https://shot.example/wa.jpg",
      hasScreenshot: true,
    });
  });
});
