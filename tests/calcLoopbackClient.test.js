// ═══════════════════════════════════════════════════════════════════════════
// Unit + integration tests — calcLoopbackClient
// Run: node tests/calcLoopbackClient.test.js
// ═══════════════════════════════════════════════════════════════════════════
//
// Two layers:
//  1. Unit  — stub global.fetch, assert host/path/body and result normalization
//  2. Integ — mount a minimal Express app on 127.0.0.1:0, point config.port at
//             it, exercise postCotizar/postPresupuestoLibre/postCotizarPdf and
//             confirm they dispatch to the real loopback host without DNS.

import express from "express";

let passed = 0;
let failed = 0;

function assert(name, condition, actual, expected) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${name} — got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)}`);
    failed += 1;
  }
}

async function runUnit() {
  console.log("\n═══ SUITE: calcLoopbackClient unit ═══");

  const { config } = await import("../server/config.js");
  config.port = 13017;
  config.publicBaseUrl = "http://localhost:13017";
  config.apiAuthToken = "loopback_service_token";

  const calls = [];
  const realFetch = globalThis.fetch;

  globalThis.fetch = async (url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method || "GET",
      body: init.body || null,
      headers: init.headers || {},
    });
    if (String(url).endsWith("/calc/cotizar")) {
      return new Response(JSON.stringify({ ok: true, resumen: { total_usd: 1234 } }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url).endsWith("/calc/cotizar/presupuesto-libre")) {
      return new Response(JSON.stringify({ ok: true, resumen: { total_usd: 99 }, bom: [] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url).endsWith("/calc/cotizar/pdf")) {
      return new Response(JSON.stringify({ ok: true, pdf_id: "abc", pdf_url: "/calc/pdf/abc" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: false, error: "unknown route" }), { status: 404 });
  };

  // Force a fresh module load so it picks up the patched config.port.
  const mod = await import(`../server/lib/calcLoopbackClient.js?u=${Date.now()}`);

  const r1 = await mod.postCotizar({ lista: "web", escenario: "solo_techo" });
  assert("postCotizar hits 127.0.0.1:port loopback", calls[0].url.startsWith("http://127.0.0.1:13017/"), calls[0].url, "127.0.0.1:13017");
  assert("postCotizar path correct", calls[0].url.endsWith("/calc/cotizar"), calls[0].url, "/calc/cotizar");
  assert("loopback posts include service Bearer", calls[0].headers.Authorization === "Bearer loopback_service_token", calls[0].headers, "Bearer token");
  assert("postCotizar normalizes ok=true", r1.ok === true, r1.ok, true);
  assert("postCotizar returns body", r1.body?.resumen?.total_usd === 1234, r1.body, { resumen: { total_usd: 1234 } });

  const r2 = await mod.postPresupuestoLibre({ lista: "web" });
  assert("postPresupuestoLibre path correct", calls[1].url.endsWith("/calc/cotizar/presupuesto-libre"), calls[1].url, "presupuesto-libre");
  assert("postPresupuestoLibre ok=true", r2.ok === true, r2.ok, true);

  const r3 = await mod.postCotizarPdf({ escenario: "solo_techo" });
  assert("postCotizarPdf path correct", calls[2].url.endsWith("/calc/cotizar/pdf"), calls[2].url, "/calc/cotizar/pdf");
  assert("postCotizarPdf ok=true", r3.ok === true, r3.ok, true);

  // 4xx → ok=false, error surfaced
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: "bad input" }), { status: 400 });
  const r4 = await mod.postCotizar({});
  assert("4xx response → ok=false", r4.ok === false, r4.ok, false);
  assert("4xx response → error surfaced", r4.error === "bad input", r4.error, "bad input");

  // Transport-level failure on PDF → falls back to publicBaseUrl
  let attempt = 0;
  const fallbackCalls = [];
  globalThis.fetch = async (url, init = {}) => {
    attempt += 1;
    fallbackCalls.push({ url: String(url), headers: init.headers || {} });
    if (attempt === 1) throw new Error("connect ECONNREFUSED");
    return new Response(JSON.stringify({ ok: true, pdf_id: "fallback" }), { status: 200 });
  };
  config.publicBaseUrl = "https://example-fallback.run.app";
  const r5 = await mod.postCotizarPdf({});
  assert("PDF transport failure triggers fallback", r5.ok === true && r5.body?.pdf_id === "fallback", r5, { ok: true });
  assert("PDF fallback was attempted twice", attempt === 2, attempt, 2);
  assert("public fallback does not forward service Bearer", !fallbackCalls[1].headers.Authorization, fallbackCalls[1].headers, "no Authorization");

  globalThis.fetch = realFetch;
}

async function runIntegration() {
  console.log("\n═══ SUITE: calcLoopbackClient integration ═══");

  const { config } = await import("../server/config.js");
  config.apiAuthToken = "loopback_service_token";

  const app = express();
  app.use(express.json());
  app.post("/calc/cotizar", (req, res) => res.json({
    ok: true, echo: req.body, resumen: { total_usd: 4242 },
  }));
  app.post("/calc/cotizar/pdf", (req, res) => res.json({ ok: true, pdf_id: "int-1", source: req.body?.source }));

  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address();
  config.port = port;
  config.publicBaseUrl = `http://127.0.0.1:${port}`;

  const mod = await import(`../server/lib/calcLoopbackClient.js?u=${Date.now()}`);

  const r1 = await mod.postCotizar({ lista: "web", escenario: "solo_techo", source: "ae_agent" });
  assert("integration: postCotizar dispatches to mounted express", r1.ok === true && r1.body?.resumen?.total_usd === 4242, r1.body, { total_usd: 4242 });
  assert("integration: body forwarded intact", r1.body?.echo?.source === "ae_agent", r1.body?.echo, "{source:ae_agent}");

  const r2 = await mod.postCotizarPdf({ source: "ae_agent" });
  assert("integration: postCotizarPdf reaches handler", r2.ok === true && r2.body?.pdf_id === "int-1", r2.body, { pdf_id: "int-1" });

  await new Promise((resolve) => server.close(resolve));
}

(async () => {
  try {
    await runUnit();
    await runIntegration();
  } catch (err) {
    console.error("Suite crashed:", err);
    process.exit(1);
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})();
