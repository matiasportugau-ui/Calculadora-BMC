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
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
    req.end();
  });
}

async function main() {
  const config = { corsOrigins: ["https://calculadora-bmc.vercel.app", "http://localhost:5173"] };
  const app = express();
  app.use(createCsrfProtection(config, null));
  app.all("/t", (_req, res) => res.json({ ok: true }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const EVIL = { origin: "https://evil.example", "sec-fetch-site": "cross-site" };
  const COOKIE = { cookie: "bmc_sess=abc" };

  try {
    assert("GET con cookie + origen hostil → 200 (método seguro)",
      (await request(port, "GET", "/t", { ...COOKIE, ...EVIL })) === 200);
    assert("POST sin cookie + origen hostil → 200 (Bearer/webhook path)",
      (await request(port, "POST", "/t", EVIL)) === 200);
    assert("POST cookie + cross-site hostil → 403",
      (await request(port, "POST", "/t", { ...COOKIE, ...EVIL })) === 403);
    assert("PATCH cookie + cross-site hostil → 403",
      (await request(port, "PATCH", "/t", { ...COOKIE, ...EVIL })) === 403);
    assert("POST cookie + sec-fetch-site same-origin → 200",
      (await request(port, "POST", "/t", { ...COOKIE, "sec-fetch-site": "same-origin" })) === 200);
    assert("POST cookie + sec-fetch-site none (barra direcciones) → 200",
      (await request(port, "POST", "/t", { ...COOKIE, "sec-fetch-site": "none" })) === 200);
    assert("POST cookie + Origin permitido → 200",
      (await request(port, "POST", "/t", { ...COOKIE, origin: "https://calculadora-bmc.vercel.app", "sec-fetch-site": "cross-site" })) === 200);
    assert("POST cookie + Referer permitido (sin Origin) → 200",
      (await request(port, "POST", "/t", { ...COOKIE, referer: "http://localhost:5173/hub/banco", "sec-fetch-site": "cross-site" })) === 200);
    assert("POST cookie + origen extensión chrome → 200",
      (await request(port, "POST", "/t", { ...COOKIE, origin: "chrome-extension://abcdef", "sec-fetch-site": "cross-site" })) === 200);
    assert("POST cookie + X-CSRF-Token (fuerza preflight) → 200",
      (await request(port, "POST", "/t", { ...COOKIE, ...EVIL, "x-csrf-token": "1" })) === 200);
    assert("POST cookie + X-Requested-With → 200",
      (await request(port, "POST", "/t", { ...COOKIE, ...EVIL, "x-requested-with": "XMLHttpRequest" })) === 200);
    assert("POST cookie sin headers de navegador → 200 (cliente no-browser)",
      (await request(port, "POST", "/t", COOKIE)) === 200);
    assert("POST cookie + Referer inválido y hostil → 403",
      (await request(port, "POST", "/t", { ...COOKIE, referer: "https://evil.example/x", "sec-fetch-site": "cross-site" })) === 403);
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
