// Banco — contrato offline del router (sin DATABASE_URL, sin red).
//   - GET  /api/banco/health     → 503 (DB no configurada)
//   - GET  /api/banco/movements → RBAC banco:read antes que DB
//   - POST /api/banco/import     → rol admin antes que DB
// Espeja tests/traktime-contract.test.js.
// Run: node tests/banco-routes.test.js

import http from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import createBancoRouter from "../server/routes/banco.js";
import { isDbConnectionError, resetBancoPoolForTests } from "../server/lib/bancoDb.js";
import { __test__ as identityAuthTest, initIdentityAuth } from "../server/lib/identityAuth.js";

process.env.APP_ENV = "test";
process.env.IDENTITY_JWT_SECRET = "test_test_test_test_test_test_test_secret_xx";

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

function requestJson(port, method, path, body, authorization = null) {
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
          ...(authorization ? { Authorization: authorization } : {}),
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

function makeIdentityPool() {
  const users = [
    {
      user_id: "u-comprador",
      email: "comprador@bmc.test",
      name: "Comprador",
      picture_url: null,
      avatar_preset: null,
      plan_tier: "base",
      status: "active",
      jwt_revoked_at: null,
      role: "comprador",
      grants: [],
    },
    {
      user_id: "u-operator",
      email: "operator@bmc.test",
      name: "Operator",
      picture_url: null,
      avatar_preset: null,
      plan_tier: "plus",
      status: "active",
      jwt_revoked_at: null,
      role: "operator",
      grants: [{ module: "banco", level: "read" }],
    },
    {
      user_id: "u-admin",
      email: "admin@bmc.test",
      name: "Admin",
      picture_url: null,
      avatar_preset: null,
      plan_tier: "plus",
      status: "active",
      jwt_revoked_at: null,
      role: "admin",
      grants: [],
    },
  ];

  return {
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
      const user = users.find((candidate) => candidate.user_id === params[0]);
      if (normalized.startsWith("select user_id, email, name, picture_url")) {
        return { rows: user ? [user] : [] };
      }
      if (normalized.startsWith("select role from identity.role_grants")) {
        return { rows: user ? [{ role: user.role }] : [] };
      }
      if (normalized.startsWith("select module, level from identity.module_grants")) {
        return { rows: user?.grants || [] };
      }
      if (normalized.startsWith("update identity.users set last_active_at = now()")) {
        return { rows: [] };
      }
      throw new Error(`Unhandled identity SQL: ${normalized.slice(0, 120)}`);
    },
  };
}

function bearerFor(userId) {
  const token = jwt.sign(
    { sub: userId, sid: "sess-banco-test", subject_type: "user" },
    process.env.IDENTITY_JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: 15 * 60,
      issuer: "bmc-identity",
      audience: "bmc-identity-api",
    },
  );
  return `Bearer ${token}`;
}

async function main() {
  await resetBancoPoolForTests();
  identityAuthTest.reset();
  initIdentityAuth({
    pool: makeIdentityPool(),
    logger: { warn() {}, error() {}, info() {} },
  });
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

    const deniedRead = await requestJson(
      port,
      "GET",
      "/api/banco/movements",
      null,
      bearerFor("u-comprador"),
    );
    assert("comprador sin banco grant → 403", deniedRead.status === 403, deniedRead);
    assert(
      "lectura exige grant banco:read",
      deniedRead.body?.error === "insufficient_module_grant"
        && deniedRead.body?.required?.module === "banco"
        && deniedRead.body?.required?.minLevel === "read",
      deniedRead.body,
    );

    const grantedRead = await requestJson(
      port,
      "GET",
      "/api/banco/movements",
      null,
      bearerFor("u-operator"),
    );
    assert("operator con banco:read supera RBAC → 503 sin DB", grantedRead.status === 503, grantedRead);
    assert(
      "lectura autorizada alcanza requireDb",
      grantedRead.body?.error === "DATABASE_URL not configured",
      grantedRead.body,
    );

    const deniedImport = await requestJson(
      port,
      "POST",
      "/api/banco/import",
      { csv: "Fecha,Débito\n" },
      bearerFor("u-operator"),
    );
    assert("operator con banco:read no puede importar → 403", deniedImport.status === 403, deniedImport);
    assert(
      "import exige rol admin",
      deniedImport.body?.error === "insufficient_role"
        && deniedImport.body?.required === "admin"
        && deniedImport.body?.have === "operator",
      deniedImport.body,
    );

    const adminImport = await requestJson(
      port,
      "POST",
      "/api/banco/import",
      { csv: "Fecha,Débito\n" },
      bearerFor("u-admin"),
    );
    assert("admin supera RBAC de import → 503 sin DB", adminImport.status === 503, adminImport);
    assert(
      "import autorizado alcanza requireDb",
      adminImport.body?.error === "DATABASE_URL not configured",
      adminImport.body,
    );

    const deniedRuleWrite = await requestJson(
      port,
      "POST",
      "/api/banco/rules",
      { pattern: "abc", categoria: "ventas" },
      bearerFor("u-operator"),
    );
    assert("operator no puede crear reglas bancarias → 403", deniedRuleWrite.status === 403, deniedRuleWrite);

    // isDbConnectionError: fallas de infra → 503; errores de programación → 500
    assert("ECONNREFUSED es error de conexión", isDbConnectionError({ code: "ECONNREFUSED" }));
    assert("08006 (connection_failure) es error de conexión", isDbConnectionError({ code: "08006" }));
    assert("'Connection terminated unexpectedly' es error de conexión",
      isDbConnectionError({ message: "Connection terminated unexpectedly" }));
    assert("timeout de pool es error de conexión",
      isDbConnectionError({ message: "timeout exceeded when trying to connect" }));
    assert("syntax error (42601) NO es error de conexión", !isDbConnectionError({ code: "42601", message: "syntax error" }));
    assert("unique_violation (23505) NO es error de conexión", !isDbConnectionError({ code: "23505" }));
    assert("null NO es error de conexión", !isDbConnectionError(null));
  } finally {
    server.close();
    await resetBancoPoolForTests();
    identityAuthTest.reset();
  }

  console.log(`\nbanco-routes: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
