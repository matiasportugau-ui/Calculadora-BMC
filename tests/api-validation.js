import express from "express";
import calcRouter from "../server/routes/calc.js";

let passed = 0;
let failed = 0;

function assert(name, condition, actual, expected) {
  if (condition) {
    console.log(`  OK ${name}`);
    passed += 1;
  } else {
    console.log(`  FAIL ${name} - got: ${actual}, expected: ${expected}`);
    failed += 1;
  }
}

async function parseBody(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await parseBody(response),
    headers: response.headers,
  };
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    status: response.status,
    body: await parseBody(response),
    headers: response.headers,
  };
}

const roofPayload = {
  familia: "ISODEC_EPS",
  espesor: 100,
  largo: 5.0,
  ancho: 5.6,
  tipoEst: "metal",
  borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
  opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
  color: "Blanco",
};

async function run() {
  console.log("\n=== API Suite: calc router regressions ===");

  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use((req, _res, next) => {
    req.log = { error: () => {}, info: () => {} };
    next();
  });
  app.use("/calc", calcRouter);

  const server = await new Promise((resolve) => {
    const srv = app.listen(0, "127.0.0.1", () => resolve(srv));
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const missingCamara = await postJson(baseUrl, "/calc/cotizar", {
      escenario: "camara_frig",
      pared: { familia: "ISOPANEL_EPS", espesor: 100, color: "Blanco" },
    });
    assert("camara_frig missing dimensions returns 400", missingCamara.status === 400, missingCamara.status, 400);
    assert(
      "camara_frig error explains required fields",
      String(missingCamara.body?.error || "").includes("camara.largo_int"),
      missingCamara.body?.error,
      "message mentioning camara.largo_int"
    );

    const camaraMapped = await postJson(baseUrl, "/calc/cotizar", {
      escenario: "camara_frig",
      lista: "web",
      pared: { familia: "ISOWALL_PIR", espesor: 80, color: "Blanco" },
      camara: { largo_int: 6, ancho_int: 4, alto_int: 3 },
    });
    assert("camara_frig valid payload returns 200", camaraMapped.status === 200, camaraMapped.status, 200);
    assert("camara_frig response ok=true", camaraMapped.body?.ok === true, camaraMapped.body?.ok, true);
    const mappedWarning = (camaraMapped.body?.advertencias || []).find((w) => w.includes("Techo camara: espesor") || w.includes("Techo cámara: espesor"));
    assert("camara_frig includes espesor mapping warning", Boolean(mappedWarning), mappedWarning, "warning present");
    assert(
      "camara_frig warning includes original and mapped thickness",
      String(mappedWarning || "").includes("80mm") && String(mappedWarning || "").includes("100mm"),
      mappedWarning,
      "contains 80mm and 100mm"
    );
    assert("camara_frig computes non-zero total", Number(camaraMapped.body?.resumen?.total_usd) > 0, camaraMapped.body?.resumen?.total_usd, "> 0");

    const invalidCombo = await postJson(baseUrl, "/calc/cotizar", {
      escenario: "techo_fachada",
      lista: "web",
    });
    assert("techo_fachada without techo/pared returns 400", invalidCombo.status === 400, invalidCombo.status, 400);
    assert(
      "techo_fachada error is explicit",
      String(invalidCombo.body?.error || "").includes("al menos techo o pared"),
      invalidCombo.body?.error,
      "message mentioning techo o pared"
    );

    const noFlete = await postJson(baseUrl, "/calc/cotizar", {
      escenario: "solo_techo",
      lista: "web",
      techo: roofPayload,
    });
    const withFlete = await postJson(baseUrl, "/calc/cotizar", {
      escenario: "solo_techo",
      lista: "web",
      techo: roofPayload,
      flete: 280,
    });
    assert("solo_techo without flete returns 200", noFlete.status === 200, noFlete.status, 200);
    assert("solo_techo with flete returns 200", withFlete.status === 200, withFlete.status, 200);

    const servicioGroup = withFlete.body?.bom?.find((g) => g.grupo === "SERVICIOS");
    const fleteItem = servicioGroup?.items?.find((i) => i.sku === "FLETE");
    assert("flete adds SERVICIOS group", Boolean(servicioGroup), servicioGroup?.grupo, "SERVICIOS");
    assert("flete item uses request value as pu", fleteItem?.pu_usd === 280, fleteItem?.pu_usd, 280);
    assert("flete item uses request value as total", fleteItem?.total_usd === 280, fleteItem?.total_usd, 280);

    const subtotalDelta = +((withFlete.body?.resumen?.subtotal_usd || 0) - (noFlete.body?.resumen?.subtotal_usd || 0)).toFixed(2);
    const totalDelta = +((withFlete.body?.resumen?.total_usd || 0) - (noFlete.body?.resumen?.total_usd || 0)).toFixed(2);
    assert("flete increases subtotal exactly by flete", subtotalDelta === 280, subtotalDelta, 280);
    assert("flete increases total by flete plus IVA", totalDelta === 341.6, totalDelta, 341.6);

    const pdfResponse = await postJson(baseUrl, "/calc/cotizar/pdf", {
      escenario: "solo_techo",
      lista: "web",
      techo: roofPayload,
      cliente: { nombre: "QA Bot", quote_code: "QA-API-001" },
    });
    assert("cotizar/pdf returns 200", pdfResponse.status === 200, pdfResponse.status, 200);
    assert("cotizar/pdf returns ok=true", pdfResponse.body?.ok === true, pdfResponse.body?.ok, true);
    assert(
      "cotizar/pdf returns view URL",
      String(pdfResponse.body?.pdf_url || "").includes("/calc/pdf/"),
      pdfResponse.body?.pdf_url,
      "URL containing /calc/pdf/"
    );

    const pdfPath = new URL(pdfResponse.body.pdf_url).pathname;
    const pdfViewer = await fetch(`${baseUrl}${pdfPath}`);
    const pdfHtml = await pdfViewer.text();
    assert("pdf viewer returns 200", pdfViewer.status === 200, pdfViewer.status, 200);
    assert(
      "pdf viewer serves HTML",
      String(pdfViewer.headers.get("content-type") || "").includes("text/html"),
      pdfViewer.headers.get("content-type"),
      "text/html"
    );
    assert("pdf viewer body looks like HTML", pdfHtml.includes("<!DOCTYPE html>") || pdfHtml.includes("<html"), "html body", "<html>");

    const cotizaciones = await getJson(baseUrl, "/calc/cotizaciones");
    assert("cotizaciones endpoint returns 200", cotizaciones.status === 200, cotizaciones.status, 200);
    assert(
      "cotizaciones includes generated quote",
      (cotizaciones.body?.cotizaciones || []).some((c) => c.code === "QA-API-001"),
      JSON.stringify((cotizaciones.body?.cotizaciones || []).map((c) => c.code)),
      "contains QA-API-001"
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }

  console.log(`\nRESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
