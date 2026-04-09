// ═══════════════════════════════════════════════════════════════════════════
// API route validation tests — calc router regressions
// Run: node tests/calc-routes.validation.js
// ═══════════════════════════════════════════════════════════════════════════

import express from "express";
import calcRouter from "../server/routes/calc.js";

let passed = 0;
let failed = 0;

function assert(name, condition, actual, expected) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed += 1;
    return;
  }
  console.log(`  ❌ ${name} — got: ${actual}, expected: ${expected}`);
  failed += 1;
}

function approx(a, b, tol = 0.02) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

async function run() {
  console.log("\n═══ API SUITE: Calc Routes Regression Coverage ═══");

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/calc", calcRouter);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const postJson = async (path, body) => {
    const resp = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    return { status: resp.status, json, headers: resp.headers };
  };

  const getText = async (path) => {
    const resp = await fetch(`${baseUrl}${path}`);
    const text = await resp.text();
    return { status: resp.status, text, headers: resp.headers };
  };

  try {
    // ── Test 1: required scenario validation ───────────────────────────────
    const invalidScenario = await postJson("/calc/cotizar", { lista: "web" });
    assert(
      "POST /calc/cotizar returns 400 when escenario is missing",
      invalidScenario.status === 400,
      invalidScenario.status,
      400
    );
    assert(
      "Error message explains missing escenario",
      String(invalidScenario.json?.error || "").includes("escenario"),
      invalidScenario.json?.error,
      "contains 'escenario'"
    );

    // ── Test 2: freight line is included in BOM and totals ────────────────
    const baseCotizacionBody = {
      lista: "web",
      escenario: "solo_techo",
      techo: {
        familia: "ISODEC_EPS",
        espesor: 100,
        largo: 5,
        ancho: 5.6,
        tipoEst: "metal",
        borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
        opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
        color: "Blanco",
      },
    };

    const sinFlete = await postJson("/calc/cotizar", baseCotizacionBody);
    const conFlete = await postJson("/calc/cotizar", { ...baseCotizacionBody, flete: 321.5 });

    assert("POST /calc/cotizar base response ok", sinFlete.status === 200 && sinFlete.json?.ok === true, sinFlete.status, 200);
    assert("POST /calc/cotizar with flete response ok", conFlete.status === 200 && conFlete.json?.ok === true, conFlete.status, 200);

    const servicios = conFlete.json?.bom?.find((g) => g.grupo === "SERVICIOS");
    const fleteItem = servicios?.items?.find((i) => i.sku === "FLETE");
    assert("Freight group is present when flete > 0", !!servicios, servicios?.grupo, "SERVICIOS");
    assert("Freight line preserves exact user amount", approx(fleteItem?.total_usd, 321.5, 0.001), fleteItem?.total_usd, 321.5);

    const subtotalDiff = Number(conFlete.json?.resumen?.subtotal_usd || 0) - Number(sinFlete.json?.resumen?.subtotal_usd || 0);
    assert(
      "Subtotal delta matches freight amount",
      approx(subtotalDiff, 321.5, 0.01),
      subtotalDiff.toFixed(2),
      "321.50"
    );

    // ── Test 3: camera scenario maps unsupported wall setup to roof fallback
    const camara = await postJson("/calc/cotizar", {
      lista: "web",
      escenario: "camara_frig",
      pared: {
        familia: "ISOWALL_PIR",
        espesor: 80,
        color: "Blanco",
        tipoEst: "metal",
        inclSell: true,
      },
      camara: {
        largo_int: 6,
        ancho_int: 4,
        alto_int: 3,
      },
    });

    assert("POST /calc/cotizar camera response ok", camara.status === 200 && camara.json?.ok === true, camara.status, 200);
    const warnings = camara.json?.advertencias || [];
    assert("Camera mapping warning is emitted", warnings.some((w) => String(w).includes("espesor 80mm")), warnings.join(" | "), "includes mapped espesor warning");
    assert("Camera summary returns positive total", Number(camara.json?.resumen?.total_usd || 0) > 0, camara.json?.resumen?.total_usd, ">0");

    // ── Test 4: PDF endpoint stores document and registry metadata ─────────
    const pdfResp = await postJson("/calc/cotizar/pdf", {
      ...baseCotizacionBody,
      cliente: {
        nombre: "QA Regression",
        quote_code: "QA-ROUTES-001",
      },
    });

    assert("POST /calc/cotizar/pdf returns ok", pdfResp.status === 200 && pdfResp.json?.ok === true, pdfResp.status, 200);
    assert("PDF response includes pdf_id", typeof pdfResp.json?.pdf_id === "string" && pdfResp.json.pdf_id.length > 0, pdfResp.json?.pdf_id, "non-empty string");
    assert(
      "PDF response url points to calc/pdf route",
      String(pdfResp.json?.pdf_url || "").includes(`/calc/pdf/${pdfResp.json?.pdf_id}`),
      pdfResp.json?.pdf_url,
      `contains /calc/pdf/${pdfResp.json?.pdf_id}`
    );

    const pdfView = await getText(`/calc/pdf/${pdfResp.json.pdf_id}`);
    assert("GET /calc/pdf/:id returns HTML", pdfView.status === 200, pdfView.status, 200);
    assert(
      "Stored PDF HTML contains client data",
      pdfView.text.includes("QA Regression") || pdfView.text.includes("QA-ROUTES-001"),
      "contains client text",
      "contains QA Regression or QA-ROUTES-001"
    );

    const cotizaciones = await getText("/calc/cotizaciones");
    const cotizacionesJson = JSON.parse(cotizaciones.text);
    assert("GET /calc/cotizaciones returns ok", cotizaciones.status === 200 && cotizacionesJson?.ok === true, cotizaciones.status, 200);
    assert(
      "Quotation registry contains generated quotation",
      (cotizacionesJson?.cotizaciones || []).some((c) => c.id === pdfResp.json.pdf_id && c.client === "QA Regression"),
      `count=${cotizacionesJson?.count || 0}`,
      "contains QA Regression entry"
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`RESULTADOS API: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${"═".repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

await run();
