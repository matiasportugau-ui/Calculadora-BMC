#!/usr/bin/env node
/**
 * Smoke test contra API desplegada (p. ej. Cloud Run) sin levantar servidor local.
 *
 * Uso:
 *   npm run smoke:prod
 *   BMC_API_BASE=https://panelin-calc-....run.app npm run smoke:prod
 *   node scripts/smoke-prod-api.mjs --base https://...
 *   node scripts/smoke-prod-api.mjs --json
 *
 * Falla (exit 1) si GET /health o GET /capabilities no responden 200,
 * si GET /api/actualizar-precios-calculadora no devuelve CSV MATRIZ (200 + text/csv + cabecera),
 * o si POST /api/crm/suggest-response no devuelve 200 + ok: true (IA configurada en prod).
 * GET /auth/ml/status: 200 o 404 OK; otro código avisa pero no falla el smoke.
 *
 * Comprueba que public_base_url en /capabilities coincide con la base probada (advertencia si no).
 *
 * Omitir solo MATRIZ (p. ej. entorno sin Sheets): SMOKE_SKIP_MATRIZ=1 o --skip-matriz.
 */
/** Default prod base — keep aligned with `gcloud run services describe panelin-calc --region=us-central1 --project=chatbot-bmc-live --format='value(status.url)'`. */
const DEFAULT_BASE = "https://panelin-calc-q74zutv7dq-uc.a.run.app";
const TIMEOUT_MS = 25_000;

function parseArgs(argv) {
  let base = process.env.BMC_API_BASE || process.env.SMOKE_BASE_URL || DEFAULT_BASE;
  let json = false;
  let skipMatriz =
    process.env.SMOKE_SKIP_MATRIZ === "1" || process.env.SMOKE_SKIP_MATRIZ === "true";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base" && argv[i + 1]) {
      base = argv[++i];
    } else if (argv[i] === "--json") {
      json = true;
    } else if (argv[i] === "--skip-matriz") {
      skipMatriz = true;
    }
  }
  return { base, json, skipMatriz };
}

function normalizeBase(url) {
  const s = String(url || "").trim().replace(/\/+$/, "");
  if (!s) return DEFAULT_BASE;
  if (!/^https?:\/\//i.test(s)) {
    throw new Error(`Base URL must start with http(s)://, got: ${url}`);
  }
  return s;
}

async function fetchJson(method, path, base, bodyObj) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const opts = {
      method,
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    };
    if (bodyObj != null) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(bodyObj);
    }
    const res = await fetch(`${base}${path}`, opts);
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { _raw: text.slice(0, 200) };
    }
    return { status: res.status, body: parsed };
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(method, path, base) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      method,
      signal: ctrl.signal,
      headers: { Accept: "text/csv,text/plain,*/*" },
    });
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "";
    return { status: res.status, contentType, text };
  } finally {
    clearTimeout(t);
  }
}

/** True if response looks like MATRIZ export CSV (not JSON error). */
function matrizCsvOk({ status, contentType, text }) {
  if (status !== 200 || !text) return false;
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") && trimmed.includes('"error"')) return false;
  const ct = String(contentType).toLowerCase();
  if (!ct.includes("csv") && !ct.includes("text/plain")) return false;
  const firstDataLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) || "";
  return (
    firstDataLine.includes("path") &&
    firstDataLine.includes("descripcion") &&
    firstDataLine.includes("venta_web") &&
    firstDataLine.includes("venta_web_iva_inc")
  );
}

async function main() {
  const { base: rawBase, json, skipMatriz } = parseArgs(process.argv.slice(2));
  let base;
  try {
    base = normalizeBase(rawBase);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const rows = [];
  let criticalFail = false;

  const h = await fetchJson("GET", "/health", base);
  const healthOk = h.status === 200 && h.body && h.body.ok === true;
  rows.push({
    path: "/health",
    status: h.status,
    ok: healthOk,
    note: healthOk ? "servicio vivo" : "esperado 200 + { ok: true }",
  });
  if (!healthOk) criticalFail = true;

  const c = await fetchJson("GET", "/capabilities", base);
  const capOk = c.status === 200 && c.body && typeof c.body === "object";
  rows.push({
    path: "/capabilities",
    status: c.status,
    ok: capOk,
    note: capOk ? "manifest agentes" : "esperado 200 JSON",
  });
  if (!capOk) criticalFail = true;

  const pub = c.body?.public_base_url ? String(c.body.public_base_url).replace(/\/+$/, "") : "";
  const baseMatch = !pub || pub === base;
  rows.push({
    path: "public_base_url",
    status: pub ? 200 : 0,
    ok: baseMatch,
    note: baseMatch
      ? "coincide con la base del smoke"
      : `manifest dice ${pub || "?"} — smoke usa ${base} (ajustar PUBLIC_BASE_URL o --base)`,
  });
  if (!baseMatch) {
    // No falla el job: solo alerta de drift; descomentar para endurecer:
    // criticalFail = true;
  }

  if (skipMatriz) {
    rows.push({
      path: "GET /api/actualizar-precios-calculadora",
      status: 0,
      ok: true,
      note: "omitido (SMOKE_SKIP_MATRIZ / --skip-matriz)",
    });
  } else {
    const mat = await fetchText("GET", "/api/actualizar-precios-calculadora", base);
    const matrizOk = matrizCsvOk(mat);
    rows.push({
      path: "GET /api/actualizar-precios-calculadora",
      status: mat.status,
      ok: matrizOk,
      note: matrizOk
        ? "CSV MATRIZ (precios calculadora)"
        : "esperado 200 + text/csv con cabecera path,descripcion — revisar Secret Manager, BMC_MATRIZ_SHEET_ID y share Sheets",
    });
    if (!matrizOk) criticalFail = true;
  }

  const m = await fetchJson("GET", "/auth/ml/status", base);
  const mlOk = m.status === 200 || m.status === 404;
  rows.push({
    path: "/auth/ml/status",
    status: m.status,
    ok: mlOk,
    note:
      m.status === 200
        ? "ML token presente"
        : m.status === 404
          ? "sin token ML (normal hasta OAuth)"
          : "revisar (informativo)",
  });

  const sr = await fetchJson("POST", "/api/crm/suggest-response", base, {
    consulta: "smoke test automatizado — responder breve",
    origen: "smoke-prod",
  });
  const suggestOk = sr.status === 200 && sr.body && sr.body.ok === true;
  rows.push({
    path: "POST /api/crm/suggest-response",
    status: sr.status,
    ok: suggestOk,
    note: suggestOk
      ? `IA ok (${sr.body.provider || "?"})`
      : "esperado 200 + { ok: true } — revisar keys IA en Cloud Run",
  });
  if (!suggestOk) criticalFail = true;

  if (json) {
    console.log(
      JSON.stringify(
        {
          ok: !criticalFail,
          base,
          at: new Date().toISOString(),
          checks: rows,
        },
        null,
        2
      )
    );
    process.exit(criticalFail ? 1 : 0);
    return;
  }

  console.log("");
  console.log("Smoke producción (API pública)");
  console.log(`  Base: ${base}`);
  console.log("");
  for (const r of rows) {
    const mark = r.ok ? "✓" : "✗";
    const st = r.status != null ? r.status : "-";
    console.log(`  ${mark}  ${st}  ${r.path}`);
    console.log(`      ${r.note}`);
  }
  console.log("");
  if (criticalFail) {
    const bad = rows.filter((r) => !r.ok && ["/health", "GET /api/actualizar-precios-calculadora", "POST /api/crm/suggest-response"].includes(r.path));
    const hint = bad.length ? bad.map((r) => `${r.path} (${r.status})`).join("; ") : "ver checks ✗ arriba";
    console.log(`RESULTADO: FALLA — ${hint}.`);
    process.exit(1);
  }
  console.log("RESULTADO: OK — health, capabilities, MATRIZ CSV, suggest-response.");
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
