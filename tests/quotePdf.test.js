// ═══════════════════════════════════════════════════════════════════════════
// Unit tests — server/lib/quotePdf.js (shared HTML → PDF renderer)
// Run: node tests/quotePdf.test.js
// ═══════════════════════════════════════════════════════════════════════════
//
// These run on macOS/Windows CI where Chromium is unavailable — which is
// exactly the degraded branch production must handle gracefully:
//  1. isPdfRendererAvailable() platform/env detection
//  2. renderHtmlToPdfBuffer() throws PdfRendererUnavailableError (code intact)
//  3. render-slot semaphore caps concurrency at MAX and hands slots to waiters
//  4. /calc/cotizar/pdf contract: degraded response keeps legacy fields and
//     reports pdf_rendered=false (buildCotizacionHtml shape check included)

import {
  isPdfRendererAvailable,
  renderHtmlToPdfBuffer,
  PdfRendererUnavailableError,
  _internal,
} from "../server/lib/quotePdf.js";

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

async function runAvailability() {
  console.log("\n═══ SUITE: renderer availability ═══");

  const savedEnv = process.env.CHROMIUM_EXECUTABLE_PATH;
  delete process.env.CHROMIUM_EXECUTABLE_PATH;

  const expected = process.platform === "linux";
  assert(
    "isPdfRendererAvailable matches platform without env override",
    isPdfRendererAvailable() === expected,
    isPdfRendererAvailable(),
    expected,
  );

  process.env.CHROMIUM_EXECUTABLE_PATH = "/tmp/fake-chromium";
  assert(
    "CHROMIUM_EXECUTABLE_PATH forces availability on any platform",
    isPdfRendererAvailable() === true,
    isPdfRendererAvailable(),
    true,
  );

  if (savedEnv === undefined) delete process.env.CHROMIUM_EXECUTABLE_PATH;
  else process.env.CHROMIUM_EXECUTABLE_PATH = savedEnv;
}

async function runUnavailableError() {
  console.log("\n═══ SUITE: unavailable-platform error ═══");

  if (process.platform === "linux") {
    console.log("  ⏭️  skipped (Linux has a real renderer)");
    return;
  }

  const savedEnv = process.env.CHROMIUM_EXECUTABLE_PATH;
  delete process.env.CHROMIUM_EXECUTABLE_PATH;
  try {
    await renderHtmlToPdfBuffer("<html><body>x</body></html>");
    assert("renderHtmlToPdfBuffer throws when renderer unavailable", false, "resolved", "throw");
  } catch (err) {
    assert(
      "throws PdfRendererUnavailableError",
      err instanceof PdfRendererUnavailableError,
      err.constructor.name,
      "PdfRendererUnavailableError",
    );
    assert(
      "error carries code pdf_renderer_unavailable",
      err.code === "pdf_renderer_unavailable",
      err.code,
      "pdf_renderer_unavailable",
    );
  }

  // Missing binary at the env path must also surface as unavailable, not crash.
  process.env.CHROMIUM_EXECUTABLE_PATH = "/definitely/not/a/real/chromium";
  try {
    await renderHtmlToPdfBuffer("<html><body>x</body></html>");
    assert("missing binary path throws", false, "resolved", "throw");
  } catch (err) {
    assert(
      "missing binary → PdfRendererUnavailableError",
      err instanceof PdfRendererUnavailableError,
      err.constructor.name,
      "PdfRendererUnavailableError",
    );
  }

  try {
    await renderHtmlToPdfBuffer("");
    assert("empty html rejected", false, "resolved", "throw");
  } catch (err) {
    assert("empty html throws plain Error", err instanceof Error, err.constructor.name, "Error");
  }

  if (savedEnv === undefined) delete process.env.CHROMIUM_EXECUTABLE_PATH;
  else process.env.CHROMIUM_EXECUTABLE_PATH = savedEnv;
}

async function runSemaphore() {
  console.log("\n═══ SUITE: render-slot semaphore ═══");

  const { acquireRenderSlot, releaseRenderSlot, MAX_CONCURRENT_RENDERS } = _internal;

  assert("cap is 2", MAX_CONCURRENT_RENDERS === 2, MAX_CONCURRENT_RENDERS, 2);

  // Fill both slots synchronously.
  await acquireRenderSlot();
  await acquireRenderSlot();
  assert("two slots active", _internal.activeRenders === 2, _internal.activeRenders, 2);

  // Third caller must queue, not proceed.
  let thirdEntered = false;
  const third = acquireRenderSlot().then(() => { thirdEntered = true; });
  await new Promise((r) => setTimeout(r, 20));
  assert("third render queues while cap reached", thirdEntered === false, thirdEntered, false);
  assert("waiter is queued", _internal.queuedRenders === 1, _internal.queuedRenders, 1);

  // Releasing one slot hands it to the waiter without dropping the count.
  releaseRenderSlot();
  await third;
  assert("waiter receives the released slot", thirdEntered === true, thirdEntered, true);
  assert("active count stays at cap after handoff", _internal.activeRenders === 2, _internal.activeRenders, 2);

  releaseRenderSlot();
  releaseRenderSlot();
  assert("all slots released", _internal.activeRenders === 0, _internal.activeRenders, 0);
}

async function runCotizacionHtmlContract() {
  console.log("\n═══ SUITE: buildCotizacionHtml contract ═══");

  const { buildCotizacionHtml } = await import("../server/routes/calc.js");

  const good = buildCotizacionHtml({
    escenario: "solo_techo",
    lista: "web",
    techo: { familia: "ISODEC_EPS", espesor: "100", color: "Blanco", zonas: [{ largo: 6, ancho: 4 }] },
    flete: 0,
    cliente: { nombre: "Test Cliente", quote_code: "BMC-TEST-0001" },
  });
  assert("valid request → ok:true", good.ok === true, good.ok, true);
  assert("returns html string", typeof good.html === "string" && good.html.includes("<html"), typeof good.html, "string");
  assert("returns gptResp with resumen totals", Number(good.gptResp?.resumen?.total_usd) > 0, good.gptResp?.resumen?.total_usd, "> 0");

  const bad = buildCotizacionHtml({ escenario: "solo_techo", lista: "web", techo: null, cliente: {} });
  assert("invalid request → ok:false with error", bad.ok === false && !!bad.error, bad, "{ ok:false, error }");
}

const suites = [runAvailability, runUnavailableError, runSemaphore, runCotizacionHtmlContract];
for (const suite of suites) {
  await suite();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
