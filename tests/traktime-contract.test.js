// TraKtiMe — offline contract test.
// Mounts the router with no DATABASE_URL and asserts:
//   - GET /api/traktime/health → 503 (DB not configured)
//   - GET /api/traktime/me → 401 (auth required)
// No live DB / no Sheets dependency.
//
// Run: node tests/traktime-contract.test.js

import http from "node:http";
import express from "express";
import createTraktimeRouter from "../server/routes/traktime.js";
import { resetTraktimePoolForTests } from "../server/lib/traktimeDb.js";

let passed = 0;
let failed = 0;

function assert(name, cond, detail = "") {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function requestJson(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path,
        headers: {
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (d) => (chunks += d));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = chunks ? JSON.parse(chunks) : null;
          } catch {
            parsed = { raw: chunks };
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log("\n═══ TraKtiMe · contract (offline) ═══");

  // Ensure no stale singleton pool from prior runs.
  await resetTraktimePoolForTests();

  const app = express();
  app.use(express.json());
  app.use(createTraktimeRouter({ databaseUrl: "" }, console));

  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const port = server.address().port;

  try {
    {
      const r = await requestJson(port, "GET", "/api/traktime/health");
      assert("health → 503 when DB not configured", r.status === 503, `status=${r.status}`);
      assert("health body ok:false", r.body?.ok === false, JSON.stringify(r.body));
    }

    {
      const r = await requestJson(port, "GET", "/api/traktime/me");
      assert(
        "me → 401 without bearer",
        r.status === 401,
        `status=${r.status} body=${JSON.stringify(r.body)}`,
      );
    }

    {
      const r = await requestJson(port, "POST", "/api/traktime/timer/start", {
        project_id: "00000000-0000-0000-0000-000000000000",
      });
      assert("timer/start → 401 without bearer", r.status === 401, `status=${r.status}`);
    }

    {
      const r = await requestJson(port, "POST", "/api/traktime/clients", { name: "X" });
      assert("clients POST → 401 without bearer", r.status === 401, `status=${r.status}`);
    }

    // ── Sprint 2 endpoints
    {
      const r = await requestJson(port, "POST", "/api/traktime/admin/mirror-now");
      assert(
        "admin/mirror-now → 401 without bearer",
        r.status === 401,
        `status=${r.status}`,
      );
    }
    {
      const r = await requestJson(
        port,
        "POST",
        "/api/traktime/projects/00000000-0000-0000-0000-000000000000/members",
        { user_id: "00000000-0000-0000-0000-000000000000" },
      );
      assert(
        "projects/:id/members POST → 401 without bearer",
        r.status === 401,
        `status=${r.status}`,
      );
    }
    {
      const r = await requestJson(port, "GET", "/api/traktime/reports/billable");
      assert(
        "reports/billable → 401 without bearer",
        r.status === 401,
        `status=${r.status}`,
      );
    }
  } finally {
    await new Promise((r) => server.close(r));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
