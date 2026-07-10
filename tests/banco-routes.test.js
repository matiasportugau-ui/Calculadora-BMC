// Banco — contrato offline del router (sin DATABASE_URL, sin red).
//   - GET  /api/banco/health    → 503 (DB no configurada)
//   - GET  /api/banco/movements → 401 (auth antes que DB)
//   - POST /api/banco/import    → 401 sin auth
// Espeja tests/traktime-contract.test.js.
// Run: node tests/banco-routes.test.js

import http from "node:http";
import express from "express";
import createBancoRouter from "../server/routes/banco.js";
import { resetBancoPoolForTests } from "../server/lib/bancoDb.js";

let passed = 0;
let failed = 0;
function assert(name, cond, detail = "") {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ` — ${JSON.stringify(detail)}` : ""}`);
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
  await resetBancoPoolForTests();
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use(createBancoRouter({ databaseUrl: "" }, console));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  try {
    const health = await requestJson(port, "GET", "/api/banco/health");
    assert("health sin DB → 503", health.status === 503, health);
    assert("health body ok:false", health.body?.ok === false, health.body);

    const movements = await requestJson(port, "GET", "/api/banco/movements");
    assert("movements sin auth → 401", movements.status === 401, movements);

    const accounts = await requestJson(port, "GET", "/api/banco/accounts");
    assert("accounts sin auth → 401", accounts.status === 401, accounts);

    const imp = await requestJson(port, "POST", "/api/banco/import", { csv: "Fecha,Débito\n" });
    assert("import sin auth → 401", imp.status === 401, imp);

    const summary = await requestJson(port, "GET", "/api/banco/summary");
    assert("summary sin auth → 401", summary.status === 401, summary);

    const rules = await requestJson(port, "POST", "/api/banco/rules", { pattern: "abc" });
    assert("rules POST sin auth → 401", rules.status === 401, rules);
  } finally {
    server.close();
    await resetBancoPoolForTests();
  }

  console.log(`\nbanco-routes: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
