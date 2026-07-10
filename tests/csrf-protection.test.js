// CSRF (CWE-352) — contrato offline de server/middleware/csrfProtection.js.
// Métodos inseguros con cookies exigen señal de mismo origen; Bearer puro,
// webhooks y clientes no-browser pasan intactos.
// Run: node tests/csrf-protection.test.js

import http from "node:http";
import express from "express";
import createCsrfProtection from "../server/middleware/csrfProtection.js";

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

function request(port, method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode, setCookie: res.headers["set-cookie"] || [] }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const config = { corsOrigins: ["https://calculadora-bmc.vercel.app", "http://localhost:5173"], appEnv: "test" };
  const app = express();
  const cookieParser = (await import("cookie-parser")).default;
  app.use(cookieParser());
  app.use(createCsrfProtection(config, null));
  app.all("/t", (_req, res) => res.json({ ok: true }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const EVIL = { origin: "https://evil.example", "sec-fetch-site": "cross-site" };
  const COOKIE = { cookie: "bmc_sess=abc" };

  const TOKEN = "a".repeat(32);
  const CSRF_COOKIE = { cookie: `bmc_sess=abc; bmc_csrf=${TOKEN}` };

  try {
    assert("GET con cookie + origen hostil → 200 (método seguro)",
      (await request(port, "GET", "/t", { ...COOKIE, ...EVIL })).status === 200);
    assert("POST sin cookie + origen hostil → 200 (Bearer/webhook path)",
      (await request(port, "POST", "/t", EVIL)).status === 200);
    assert("POST cookie + cross-site hostil → 403",
      (await request(port, "POST", "/t", { ...COOKIE, ...EVIL })).status === 403);
    assert("PATCH cookie + cross-site hostil → 403",
      (await request(port, "PATCH", "/t", { ...COOKIE, ...EVIL })).status === 403);
    assert("POST cookie + sec-fetch-site same-origin → 200",
      (await request(port, "POST", "/t", { ...COOKIE, "sec-fetch-site": "same-origin" })).status === 200);
    assert("POST cookie + sec-fetch-site none (barra direcciones) → 200",
      (await request(port, "POST", "/t", { ...COOKIE, "sec-fetch-site": "none" })).status === 200);
    assert("POST cookie + Origin permitido → 200",
      (await request(port, "POST", "/t", { ...COOKIE, origin: "https://calculadora-bmc.vercel.app", "sec-fetch-site": "cross-site" })).status === 200);
    assert("POST cookie + Referer permitido (sin Origin) → 200",
      (await request(port, "POST", "/t", { ...COOKIE, referer: "http://localhost:5173/hub/banco", "sec-fetch-site": "cross-site" })).status === 200);
    assert("POST cookie + origen extensión chrome → 200",
      (await request(port, "POST", "/t", { ...COOKIE, origin: "chrome-extension://abcdef", "sec-fetch-site": "cross-site" })).status === 200);
    assert("POST cookie + X-CSRF-Token sin cookie gemela (fuerza preflight) → 200",
      (await request(port, "POST", "/t", { ...COOKIE, ...EVIL, "x-csrf-token": "1" })).status === 200);
    assert("POST cookie + X-Requested-With → 200",
      (await request(port, "POST", "/t", { ...COOKIE, ...EVIL, "x-requested-with": "XMLHttpRequest" })).status === 200);
    assert("POST cookie sin headers de navegador → 200 (cliente no-browser)",
      (await request(port, "POST", "/t", COOKIE)).status === 200);
    assert("POST cookie + Referer inválido y hostil → 403",
      (await request(port, "POST", "/t", { ...COOKIE, referer: "https://evil.example/x", "sec-fetch-site": "cross-site" })).status === 403);

    // ── double-submit cookie ──
    const issued = await request(port, "GET", "/t", COOKIE);
    assert("emite Set-Cookie bmc_csrf cuando falta",
      issued.setCookie.some((c) => c.startsWith("bmc_csrf=")), issued.setCookie);
    const notReissued = await request(port, "GET", "/t", CSRF_COOKIE);
    assert("no re-emite bmc_csrf si ya existe",
      !notReissued.setCookie.some((c) => c.startsWith("bmc_csrf=")), notReissued.setCookie);
    assert("POST double-submit válido + origen hostil → 200",
      (await request(port, "POST", "/t", { ...CSRF_COOKIE, ...EVIL, "x-csrf-token": TOKEN })).status === 200);
    assert("POST double-submit MISMATCH → 403 (aunque haya X-Requested-With)",
      (await request(port, "POST", "/t", { ...CSRF_COOKIE, ...EVIL, "x-csrf-token": "b".repeat(32), "x-requested-with": "XMLHttpRequest" })).status === 403);
    assert("POST double-submit token corto (<16) → 403",
      (await request(port, "POST", "/t", { cookie: "bmc_csrf=short", ...EVIL, "x-csrf-token": "short" })).status === 403);
  } finally {
    server.close();
  }

  console.log(`\ncsrf-protection: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
