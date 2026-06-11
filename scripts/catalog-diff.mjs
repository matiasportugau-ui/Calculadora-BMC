#!/usr/bin/env node
/**
 * catalog-diff.mjs — Diff determinístico catálogo (`src/data/constants.js`) ↔ MATRIZ.
 *
 * WOLF-2026-0004 (etapa 2): el control de validación que pidió Ramiro
 * ("controles de validación para evitar errores de formato decimal y precios
 * fuera de rango"). Es un job **script-based, NO LLM**: mismas entradas →
 * misma salida.
 *
 * Qué hace:
 *   1. Lee los precios del catálogo escaneando `src/data/constants.js` (fuente de
 *      verdad en código), path → { costo, venta, web }.
 *   2. Lee la MATRIZ viva como CSV (`GET /api/actualizar-precios-calculadora`,
 *      servido por la API de prod con su service-account ya montado — NO se crean
 *      credenciales nuevas) o desde un CSV local (`--matriz-csv`).
 *   3. Para cada SKU presente en ambos lados compara costo/venta/web y reporta:
 *        - `divergence` (S1): delta relativo > umbral (default 1%) y sobre el piso
 *          absoluto (default 0.01, neutraliza el redondeo a 2 decimales del CSV).
 *        - `catalog-out-of-range` (S1): valor del catálogo fuera de la banda de
 *          magnitud de su categoría (atrapa errores de coma decimal: 32,84 → 3284).
 *        - `matriz-out-of-range` (WARN): valor sucio en el origen (etapa 1, manual).
 *        - `no-source` (WARN): celda de venta/costo vacía en la MATRIZ → nunca se
 *          compara, nunca se rellena (este es el mecanismo de WOLF-0002).
 *        - `duplicate-sku` (WARN): SKU repetido en la MATRIZ → no compara nada.
 *        - `no-sku` (WARN): entrada del catálogo (p. ej. anclajes ANC*) sin fila en
 *          la MATRIZ — bloqueo conocido de etapa 1; se lista, no falla.
 *
 * Exit code:
 *   - 0 si no hay hallazgos S1 (o `--soft`).
 *   - 1 si hay ≥1 hallazgo S1 (divergencia o catálogo fuera de rango).
 *   - 0 con mensaje claro si la MATRIZ no está disponible y no se pasó
 *     `--require-matriz` (skip elegante para CI sin secreto).
 *
 * Uso:
 *   node scripts/catalog-diff.mjs                          # vs MATRIZ viva (prod)
 *   node scripts/catalog-diff.mjs --matriz-csv f.csv       # vs CSV local
 *   node scripts/catalog-diff.mjs --constants copia.js     # catálogo alternativo
 *   node scripts/catalog-diff.mjs --out audit-output/catalog-diff/2026-06-11.md
 *   node scripts/catalog-diff.mjs --json
 *   node scripts/catalog-diff.mjs --soft                   # nunca exit≠0 (cron)
 *   node scripts/catalog-diff.mjs --require-matriz         # falla si no hay MATRIZ
 *
 * Env:
 *   BMC_API_BASE                base de la API que sirve el CSV MATRIZ.
 *   BMC_CATALOG_DIFF_THRESHOLD  override del umbral relativo (ej. 0.02 = 2%).
 *   BMC_CATALOG_DIFF_SOFT=1     equivalente a --soft.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsvRows } from "../src/utils/csvPricingImport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

/* ══════════════════════════════════════════════════════════════════════════
 * CONFIG — Matias puede tunear umbral y bandas acá.
 * ── Las bandas están **derivadas de la distribución actual del catálogo**
 *    (no inventadas), con margen para movimientos legítimos. El objetivo es
 *    atrapar errores de orden de magnitud (corrimiento de coma decimal), no
 *    ajustes de precio normales — esos los atrapa el diff relativo vs MATRIZ.
 * ════════════════════════════════════════════════════════════════════════ */
export const CONFIG = {
  /** Delta relativo a partir del cual una diferencia catálogo↔MATRIZ es S1. */
  threshold: 0.01, // 1 %
  /** Piso absoluto en USD: por debajo de esto la diferencia se considera ruido
   *  de redondeo (el CSV MATRIZ redondea a 2 decimales). Evita falsos S1 en
   *  ítems sub-centavo (tornillo_t1 costo 0.0115 vs 0.01). */
  absFloor: 0.01,
  /** Endpoint que sirve el CSV MATRIZ (prod sirve la planilla viva con su
   *  service-account ya montado — reutiliza el path existente). */
  defaultApiBase: "https://panelin-calc-q74zutv7dq-uc.a.run.app",
  /**
   * Bandas de magnitud por categoría (primer match gana sobre el path del
   * catálogo). `min`/`max` en USD por unidad de venta de esa categoría.
   * Observado = rango real en constants.js hoy (referencia para tunear).
   */
  bands: [
    // Anclajes: observado costo 0.30 … web 8.00  → banda holgada
    { match: /^FIJACIONES\.anclaje/, min: 0.1, max: 20, label: "fijaciones · anclajes" },
    // Tornillos / remaches / tuercas / arandelas / tacos / varillas / caballete:
    // observado 0.0115 (tornillo_t1 costo) … 5.00 (varilla 8mm web)
    { match: /^FIJACIONES\.(tornillo|remache|tuerca|arandela|taco|varilla|caballete)/, min: 0.005, max: 30, label: "fijaciones · menudas" },
    { match: /^FIJACIONES\./, min: 0.005, max: 50, label: "fijaciones · otras" },
    // Goteros: observado 15.67 … 38.74
    { match: /^PERFIL_TECHO\.gotero/, min: 10, max: 60, label: "perfilería · goteros" },
    // Canalones: observado 62.59 … 121.69
    { match: /^PERFIL_TECHO\.canalon/, min: 40, max: 200, label: "perfilería · canalones" },
    // Cumbreras: observado 21.21 … 119.39 (colonial)
    { match: /^PERFIL_TECHO\.cumbrera/, min: 15, max: 200, label: "perfilería · cumbreras" },
    // Resto perfilería (babetas, soportes, perfil_u/g2/k2…): observado 7.40 … 31.08
    { match: /^PERFIL_(TECHO|PARED)\./, min: 5, max: 120, label: "perfilería · resto" },
    // Paneles por m²: observado 30.67 … 73.71
    { match: /^PANELS_(TECHO|PARED)\./, min: 20, max: 150, label: "paneles · USD/m²" },
    // Selladores: observado 3.00 … 25.27
    { match: /^SELLADORES\./, min: 1, max: 60, label: "selladores" },
    // Herramientas: observado 13.93 … 27.20
    { match: /^HERRAMIENTAS\./, min: 5, max: 500, label: "herramientas" },
    // Servicios (flete): variable → sin banda
    { match: /^SERVICIOS\./, min: null, max: null, label: "servicios (sin banda)" },
  ],
};

/* ══════════════════════════════════════════════════════════════════════════
 * NORMALIZER — el corazón del control de formato. Tiene tests unitarios.
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * Normaliza una celda numérica de planilla (USD), distinguiendo explícitamente
 * EMPTY vs ERROR vs OK. Nunca rellena, nunca infiere.
 *
 * @param {*} raw  valor crudo (string de CSV, número, null, …)
 * @returns {{ value: number|null, status: 'ok'|'empty'|'error', raw: string }}
 */
export function normalizeDecimal(raw) {
  const rawStr = raw == null ? "" : String(raw);
  let s = rawStr.replace(/^﻿/, "").trim();

  if (s === "") return { value: null, status: "empty", raw: rawStr };

  // Sentinelas de error de Google Sheets / Excel: #VALUE!, #REF!, #DIV/0!,
  // #N/A, #NAME?, #NULL!, #NUM!  → NUNCA un número.
  if (/^#(VALUE|REF|DIV\/0|N\/A|NAME|NULL|NUM)[!?]?$/i.test(s)) {
    return { value: null, status: "error", raw: rawStr };
  }
  // Cualquier otro token que empiece con '#' tampoco es número.
  if (s.startsWith("#")) return { value: null, status: "error", raw: rawStr };

  // Limpieza de símbolos de moneda / comillas / espacios. NO toca ',' ni '.'.
  s = s.replace(/["']/g, "").replace(/\s/g, "").replace(/\$/g, "").replace(/USD/gi, "");
  if (s === "") return { value: null, status: "empty", raw: rawStr };

  // Coma decimal explícita:
  //   "1.025,50" → miles con punto, decimal con coma → 1025.50
  //   "32,84"    → decimal con coma                  → 32.84
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  // En este punto sólo deben quedar dígitos, un punto decimal y signo.
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) {
    return { value: null, status: "error", raw: rawStr };
  }
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return { value: null, status: "error", raw: rawStr };
  return { value: n, status: "ok", raw: rawStr };
}

/* ══════════════════════════════════════════════════════════════════════════
 * CATÁLOGO — escaneo de constants.js (mismo scanner que bake-matriz-to-constants)
 * ════════════════════════════════════════════════════════════════════════ */

const PRICE_ROOTS = new Set([
  "PANELS_TECHO", "PANELS_PARED", "FIJACIONES", "HERRAMIENTAS",
  "SELLADORES", "PERFIL_TECHO", "PERFIL_PARED", "SERVICIOS",
]);
const PRICE_FIELDS = new Set(["venta", "web", "costo"]);

/**
 * Escanea el fuente de constants.js manteniendo una pila de claves y devuelve
 * `Map<path, { venta, web, costo }>`. Funciona con hojas en una línea, anidadas
 * (`_all`) y multilínea. Sólo lee exports de precio.
 */
export function scanConstantsForPrices(src) {
  const N = src.length;
  const stack = [];
  let lastToken = null;
  let currentKey = null;
  const out = new Map();
  const isIdent = (c) => /[A-Za-z0-9_$.]/.test(c);

  let i = 0;
  while (i < N) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "/") { while (i < N && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") { i += 2; while (i < N && !(src[i] === "*" && src[i + 1] === "/")) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === "`") {
      const q = c; i++;
      while (i < N && src[i] !== q) { if (src[i] === "\\") i++; i++; }
      i++; lastToken = "<str>"; continue;
    }
    if (c === "{") { stack.push(currentKey); currentKey = null; lastToken = null; i++; continue; }
    if (c === "}") { stack.pop(); currentKey = null; lastToken = null; i++; continue; }
    if (c === ":" || c === "=") { if (lastToken && lastToken !== "<str>") currentKey = lastToken; lastToken = null; i++; continue; }
    if (c === ",") { currentKey = null; lastToken = null; i++; continue; }

    if (isIdent(c)) {
      let j = i; while (j < N && isIdent(src[j])) j++;
      const tok = src.slice(i, j);
      if (currentKey && PRICE_FIELDS.has(currentKey) && PRICE_ROOTS.has(stack[0]) && /^-?\d*\.?\d+$/.test(tok)) {
        const p = stack.filter((s) => s != null).join(".");
        if (!out.has(p)) out.set(p, { venta: null, web: null, costo: null });
        out.get(p)[currentKey] = Number.parseFloat(tok);
        currentKey = null;
      }
      lastToken = tok;
      i = j; continue;
    }
    i++;
  }
  return out;
}

export function loadCatalog(constantsPath) {
  const file = constantsPath
    ? path.resolve(process.cwd(), constantsPath)
    : path.join(REPO_ROOT, "src/data/constants.js");
  const src = fs.readFileSync(file, "utf8");
  return { byPath: scanConstantsForPrices(src), file };
}

/* ══════════════════════════════════════════════════════════════════════════
 * MATRIZ — CSV (vivo o local). Detecta SKUs duplicados.
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * Parsea el CSV de la MATRIZ (header: sku,path,…,costo,venta_local,…,venta_web,…).
 * Devuelve filas normalizadas + el set de SKUs duplicados.
 */
export function parseMatrizCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return { rows: [], duplicateSkus: new Set(), headers: [] };

  const headers = rows[0].map((h) => String(h || "").trim().toLowerCase().replace(/^﻿/, ""));
  const col = (...names) => { for (const n of names) { const k = headers.indexOf(n); if (k >= 0) return k; } return -1; };
  const iSku = col("sku");
  const iPath = col("path");
  const iCosto = col("costo");
  const iVenta = col("venta_local", "venta_bmc_local", "venta_bmc", "venta");
  const iWeb = col("venta_web");

  // Contar SKUs para detectar duplicados (mismo SKU = posible producto distinto).
  const skuCount = new Map();
  for (let r = 1; r < rows.length; r++) {
    const sku = String(rows[r][iSku] || "").trim().toUpperCase();
    if (sku) skuCount.set(sku, (skuCount.get(sku) || 0) + 1);
  }
  const duplicateSkus = new Set([...skuCount].filter(([, n]) => n > 1).map(([s]) => s));

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const p = String(row[iPath] || "").trim();
    if (!p) continue;
    out.push({
      sku: String(row[iSku] || "").trim(),
      path: p,
      costo: normalizeDecimal(iCosto >= 0 ? row[iCosto] : ""),
      venta: normalizeDecimal(iVenta >= 0 ? row[iVenta] : ""),
      web: normalizeDecimal(iWeb >= 0 ? row[iWeb] : ""),
    });
  }
  return { rows: out, duplicateSkus, headers };
}

/* ══════════════════════════════════════════════════════════════════════════
 * BANDAS
 * ════════════════════════════════════════════════════════════════════════ */

export function bandForPath(p, cfg = CONFIG) {
  return cfg.bands.find((b) => b.match.test(p)) || null;
}

function outOfBand(value, band) {
  if (!band || value == null) return false;
  if (band.min != null && value < band.min) return true;
  if (band.max != null && value > band.max) return true;
  return false;
}

/* ══════════════════════════════════════════════════════════════════════════
 * DIFF
 * ════════════════════════════════════════════════════════════════════════ */

const FIELD_LABEL = { costo: "costo", venta: "venta_local", web: "venta_web" };

/**
 * @param {Map} catalogByPath
 * @param {{rows:Array, duplicateSkus:Set}} matriz
 * @param {object} cfg
 * @returns {{ findings: Array, summary: object }}
 */
export function diffCatalogVsMatriz(catalogByPath, matriz, cfg = CONFIG) {
  const findings = [];
  const matchedCatalogPaths = new Set();
  const seenPathOnce = new Set();
  const checkedCatalogBands = new Set();

  const add = (severity, type, o) => findings.push({ severity, type, ...o });

  for (const m of matriz.rows) {
    const cat = catalogByPath.get(m.path);
    const skuUpper = m.sku.toUpperCase();
    const band = bandForPath(m.path, cfg);

    // Banda de magnitud sobre el valor del catálogo → S1 (lo que controlamos).
    // Esta validación NO depende de que la fila MATRIZ sea comparable: incluso
    // con SKU duplicado, un error de coma decimal en constants.js debe bloquear.
    if (cat) {
      matchedCatalogPaths.add(m.path);
      if (!checkedCatalogBands.has(m.path)) {
        checkedCatalogBands.add(m.path);
        for (const field of ["costo", "venta", "web"]) {
          const catVal = cat[field];
          if (catVal != null && outOfBand(catVal, band)) {
            add("s1", "catalog-out-of-range", { sku: m.sku, path: m.path, field: FIELD_LABEL[field],
              catalog: catVal, band: `${band.min}–${band.max}`, bandLabel: band.label,
              detail: "Valor del catálogo fuera de banda — posible error de coma decimal." });
          }
        }
      }
    }

    // Anti-patrón: SKU duplicado → no comparar nada para esta fila.
    if (skuUpper && matriz.duplicateSkus.has(skuUpper)) {
      add("warn", "duplicate-sku", { sku: m.sku, path: m.path,
        detail: "SKU repetido en la MATRIZ — posible producto distinto; no se compara." });
      continue;
    }
    // Path repetido (varios SKU → mismo path): se nota pero se compara igual la 1ª vez.
    if (seenPathOnce.has(m.path)) {
      add("warn", "duplicate-path", { sku: m.sku, path: m.path,
        detail: "Path ya visto en otra fila MATRIZ; se comparó la primera ocurrencia." });
      continue;
    }
    seenPathOnce.add(m.path);

    if (!cat) {
      add("warn", "matriz-only", { sku: m.sku, path: m.path,
        detail: "Fila MATRIZ sin entrada en el catálogo (gap de mapeo o producto faltante)." });
      continue;
    }

    for (const field of ["costo", "venta", "web"]) {
      const matCell = m[field];
      const catVal = cat[field];

      // EMPTY en origen → nunca se compara, nunca se rellena (mecanismo WOLF-0002).
      if (matCell.status === "empty") {
        add("warn", "no-source", { sku: m.sku, path: m.path, field: FIELD_LABEL[field],
          catalog: catVal, detail: "Celda vacía en la MATRIZ — sin fuente para comparar." });
        continue;
      }
      // ZERO en un campo de precio = placeholder/dato faltante (típicamente celdas
      // #VALUE!/#REF! que la planilla resuelve a 0). No es un precio real → se trata
      // como faltante, NO como divergencia (evita porcentajes absurdos vs 0).
      if (matCell.status === "ok" && matCell.value === 0) {
        add("warn", "no-source", { sku: m.sku, path: m.path, field: FIELD_LABEL[field],
          catalog: catVal, detail: "Celda MATRIZ en 0 (placeholder/error de origen) — sin fuente real." });
        continue;
      }
      if (matCell.status === "error") {
        add("warn", "matriz-error-cell", { sku: m.sku, path: m.path, field: FIELD_LABEL[field],
          catalog: catVal, matrizRaw: matCell.raw,
          detail: `Celda con error en la MATRIZ ("${matCell.raw}") — no se compara.` });
        continue;
      }

      const matVal = matCell.value;

      // Banda de magnitud sobre el valor de la MATRIZ (origen sucio → WARN, etapa 1).
      if (outOfBand(matVal, band)) {
        add("warn", "matriz-out-of-range", { sku: m.sku, path: m.path, field: FIELD_LABEL[field],
          matriz: matVal, band: `${band.min}–${band.max}`, bandLabel: band.label,
          detail: "Valor MATRIZ fuera de la banda de magnitud — saneamiento de origen (etapa 1)." });
      }

      if (catVal == null) {
        add("warn", "catalog-missing-field", { sku: m.sku, path: m.path, field: FIELD_LABEL[field],
          matriz: matVal, detail: "El catálogo no tiene este campo de precio." });
        continue;
      }

      // Divergencia relativa catálogo↔MATRIZ.
      const absDelta = Math.abs(catVal - matVal);
      const denom = Math.max(Math.abs(matVal), 1e-9);
      const relDelta = absDelta / denom;
      if (relDelta > cfg.threshold && absDelta > cfg.absFloor) {
        add("s1", "divergence", { sku: m.sku, path: m.path, field: FIELD_LABEL[field],
          catalog: catVal, matriz: matVal,
          deltaPct: +(relDelta * 100).toFixed(2), deltaAbs: +absDelta.toFixed(4),
          detail: `Catálogo ${catVal} vs MATRIZ ${matVal} (Δ ${(relDelta * 100).toFixed(2)} %).` });
      }
    }
  }

  // Catálogo sin fila MATRIZ. Caso conocido: anclajes ANC* sin SKU en el sheet
  // (bloqueo etapa 1, Matias manual) → `no-sku`, no falla.
  for (const [p, prices] of catalogByPath) {
    if (matchedCatalogPaths.has(p)) continue;
    if (bandForPath(p, cfg) == null && !PRICE_ROOTS.has(p.split(".")[0])) continue;
    const isAnchor = /^FIJACIONES\.anclaje/.test(p);
    add("warn", isAnchor ? "no-sku" : "catalog-only", { path: p, catalog: prices,
      detail: isAnchor
        ? "Anclaje sin SKU/fila en la MATRIZ (poblar ANC* en el sheet — etapa 1)."
        : "Path del catálogo sin fila en la MATRIZ (no mapeado o no exportado)." });
  }

  const summary = countBy(findings);
  return { findings, summary };
}

function countBy(findings) {
  const byType = {};
  const bySeverity = { s1: 0, warn: 0 };
  for (const f of findings) {
    byType[f.type] = (byType[f.type] || 0) + 1;
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
  }
  return { total: findings.length, byType, bySeverity, s1: bySeverity.s1 || 0 };
}

/** Clave estable de un hallazgo (para comparar baseline ↔ head). */
export function findingKey(f) {
  return [f.type, f.path, f.field || ""].join("|");
}

/**
 * Gate de regresión: marca como `isRegression` los S1 del head que NO existían
 * en el baseline, o que empeoraron (mayor delta absoluto). Devuelve el conteo.
 * Si `baselineFindings` es null (sin baseline), todos los S1 cuentan como gate.
 *
 * @param {Array} findings  hallazgos del head (se anotan in-place)
 * @param {Array|null} baselineFindings
 * @returns {{ regressions: number, baselineMode: boolean }}
 */
export function markRegressions(findings, baselineFindings) {
  if (!baselineFindings) {
    // Sin baseline: el gate son TODOS los S1 (modo absoluto, cron).
    let s1 = 0;
    for (const f of findings) { if (f.severity === "s1") { f.isRegression = true; s1++; } }
    return { regressions: s1, baselineMode: false };
  }
  const base = new Map();
  for (const b of baselineFindings) {
    if (b.severity !== "s1") continue;
    base.set(findingKey(b), b);
  }
  let regressions = 0;
  for (const f of findings) {
    if (f.severity !== "s1") { f.isRegression = false; continue; }
    const prev = base.get(findingKey(f));
    let isReg = false;
    if (!prev) isReg = true; // S1 nuevo respecto del base
    else if (f.deltaAbs != null && prev.deltaAbs != null && f.deltaAbs > prev.deltaAbs * 1.0001) isReg = true; // empeoró
    f.isRegression = isReg;
    if (isReg) regressions++;
  }
  return { regressions, baselineMode: true };
}

/**
 * Carga los `findings` de un baseline JSON (`--json` output).
 * @returns {{ ok: true, findings: Array } | { ok: false }}
 *   ok:false ⇒ baseline indeterminado (vacío/ilegible) → el gate cae a report-only.
 */
function loadBaselineFindings(file) {
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), file), "utf8").trim();
    if (!raw) return { ok: false };
    const data = JSON.parse(raw);
    if (!Array.isArray(data.findings)) return { ok: false };
    return { ok: true, findings: data.findings };
  } catch (e) {
    console.error(`[catalog-diff] baseline ilegible (${file}): ${e.message}`);
    return { ok: false };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * REPORTE MARKDOWN
 * ════════════════════════════════════════════════════════════════════════ */

export function renderMarkdown({ findings, summary }, meta) {
  const L = [];
  const date = meta.date || new Date().toISOString().slice(0, 10);
  L.push(`# Catalog ↔ MATRIZ diff — ${date}`);
  L.push("");
  L.push("> WOLF-2026-0004 etapa 2 · job determinístico (no-LLM). Tags: `hecho confirmado` (medido), `inferencia` (banda tuneable), `duda abierta` (sin fuente).");
  L.push("");
  L.push("## Resumen");
  L.push("");
  L.push(`- Catálogo: \`${meta.catalogFile}\` — ${meta.catalogCount} paths con precio.`);
  L.push(`- MATRIZ: ${meta.matrizSource} — ${meta.matrizRows} filas con path.`);
  L.push(`- Umbral divergencia: ${(meta.cfg.threshold * 100).toFixed(2)} % · piso absoluto: ${meta.cfg.absFloor} USD.`);
  if (meta.gate && meta.gate.mode === "regression") {
    L.push(`- **Gate baseline-aware (PR):** ${meta.gate.regressions} regresión(es) S1 nueva(s)/peor(es) vs base → ${meta.gate.regressions > 0 ? "**FALLA**" : "verde"}. (S1 totales: ${summary.s1}; el drift pre-existente no bloquea.)`);
  } else if (meta.gate && meta.gate.mode === "report-only") {
    L.push(`- **Gate:** report-only (baseline indeterminado) — no bloquea. S1 totales: ${summary.s1}.`);
  } else {
    L.push(`- **Gate absoluto (cron):** S1 que fallan el job: **${summary.s1}**.`);
  }
  L.push(`- WARN: ${summary.bySeverity.warn || 0} · total hallazgos: ${summary.total}.`);
  L.push("");
  L.push("| Tipo | Severidad | Cantidad |");
  L.push("|------|-----------|----------|");
  const sevOf = (t) => (findings.find((f) => f.type === t)?.severity || "warn");
  for (const [type, n] of Object.entries(summary.byType).sort((a, b) => b[1] - a[1])) {
    L.push(`| \`${type}\` | ${sevOf(type) === "s1" ? "**S1**" : "WARN"} | ${n} |`);
  }
  L.push("");

  const rowOf = (f) => {
    const cat = f.catalog == null ? "" : (typeof f.catalog === "object" ? JSON.stringify(f.catalog) : f.catalog);
    const mat = f.matriz == null ? "" : f.matriz;
    const extra = f.deltaPct != null ? ` (Δ ${f.deltaPct}%)` : "";
    const flag = meta.gate && meta.gate.mode === "regression" && f.isRegression ? "🆕 " : "";
    return `| ${flag}${f.sku || ""} | \`${f.path}\` | ${f.field || ""} | ${cat} | ${mat}${extra} | ${f.detail} |`;
  };

  // Sección de regresiones (sólo en modo PR baseline-aware): lo que el PR introduce.
  if (meta.gate && meta.gate.mode === "regression") {
    const regs = findings.filter((f) => f.isRegression);
    L.push("## 🆕 Regresiones S1 introducidas por este PR `hecho confirmado`");
    L.push("");
    if (regs.length === 0) {
      L.push("_Ninguna — el PR no agrega divergencias ni valores fuera de rango vs la base._");
      L.push("");
    } else {
      L.push("| SKU | path | campo | catálogo | MATRIZ | detalle |");
      L.push("|-----|------|-------|----------|--------|---------|");
      for (const f of regs) L.push(rowOf(f));
      L.push("");
    }
  }

  const section = (title, types, tag) => {
    const rows = findings.filter((f) => types.includes(f.type));
    if (rows.length === 0) return;
    L.push(`## ${title} ${tag ? `\`${tag}\`` : ""}`);
    L.push("");
    L.push("| SKU | path | campo | catálogo | MATRIZ | detalle |");
    L.push("|-----|------|-------|----------|--------|---------|");
    for (const f of rows) L.push(rowOf(f));
    L.push("");
  };

  section("🔴 S1 — Divergencias (catálogo ≠ MATRIZ)", ["divergence"], "hecho confirmado");
  section("🔴 S1 — Catálogo fuera de rango", ["catalog-out-of-range"], "hecho confirmado");
  section("🟡 MATRIZ fuera de rango (origen sucio — etapa 1)", ["matriz-out-of-range"], "inferencia");
  section("🟡 Celdas con error en la MATRIZ", ["matriz-error-cell"], "duda abierta");
  section("🟡 Sin fuente (celda MATRIZ vacía)", ["no-source"], "duda abierta");
  section("🟡 SKU / path duplicado en la MATRIZ", ["duplicate-sku", "duplicate-path"], "hecho confirmado");
  section("🟡 Anclajes sin SKU (etapa 1, Matias manual)", ["no-sku"], "duda abierta");
  section("🟡 Gaps de mapeo (MATRIZ-only / catalog-only)", ["matriz-only", "catalog-only", "catalog-missing-field"], "duda abierta");

  L.push("---");
  L.push(`_Generado por \`scripts/catalog-diff.mjs\` el ${meta.generatedAt}. Determinístico: mismas entradas → misma salida._`);
  L.push("");
  return L.join("\n");
}

/* ══════════════════════════════════════════════════════════════════════════
 * CLI
 * ════════════════════════════════════════════════════════════════════════ */

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--json") a.json = true;
    else if (t === "--soft") a.soft = true;
    else if (t === "--require-matriz") a.requireMatriz = true;
    else if (t === "--matriz-csv") a.matrizCsv = argv[++i];
    else if (t === "--constants") a.constants = argv[++i];
    else if (t === "--baseline") a.baseline = argv[++i];
    else if (t === "--out") a.out = argv[++i];
    else if (t === "--base") a.base = argv[++i];
    else if (t === "--threshold") a.threshold = Number.parseFloat(argv[++i]);
    else a._.push(t);
  }
  return a;
}

async function fetchMatrizCsv(base) {
  const url = `${base.replace(/\/$/, "")}/api/actualizar-precios-calculadora`;
  const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} en ${url}${body ? ` — ${body.slice(0, 160)}` : ""}`);
  }
  const csv = await res.text();
  if (!/path,/.test(csv) || !/venta_local/.test(csv)) {
    throw new Error("La respuesta no parece el CSV MATRIZ (falta cabecera esperada).");
  }
  return { csv, source: `live · ${url}` };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = { ...CONFIG };
  if (Number.isFinite(args.threshold)) cfg.threshold = args.threshold;
  else if (process.env.BMC_CATALOG_DIFF_THRESHOLD) cfg.threshold = Number.parseFloat(process.env.BMC_CATALOG_DIFF_THRESHOLD);
  const soft = args.soft || process.env.BMC_CATALOG_DIFF_SOFT === "1";

  // Catálogo (siempre disponible).
  const { byPath: catalogByPath, file: catalogFile } = loadCatalog(args.constants);

  // MATRIZ: local o viva.
  let csv, source;
  try {
    if (args.matrizCsv) {
      csv = fs.readFileSync(path.resolve(process.cwd(), args.matrizCsv), "utf8");
      source = `local · ${args.matrizCsv}`;
    } else {
      const base = args.base || process.env.BMC_API_BASE || cfg.defaultApiBase;
      ({ csv, source } = await fetchMatrizCsv(base));
    }
  } catch (err) {
    const msg = `[catalog-diff] MATRIZ no disponible: ${err.message}`;
    if (args.requireMatriz) {
      console.error(msg + "\n(--require-matriz activo → exit 2)");
      process.exit(2);
    }
    console.error(msg + "\n[catalog-diff] Skip elegante (sin --require-matriz). exit 0.");
    process.exit(0);
  }

  const matriz = parseMatrizCsv(csv);
  const { findings, summary } = diffCatalogVsMatriz(catalogByPath, matriz, cfg);

  // Gate de regresión (PR baseline-aware) vs absoluto (cron).
  let gate; // { regressions, baselineMode, mode }
  if (args.baseline) {
    const base = loadBaselineFindings(args.baseline);
    if (base.ok) {
      gate = { ...markRegressions(findings, base.findings), mode: "regression" };
    } else {
      // Baseline indeterminado → report-only: no bloquea (la decisión de diseño
      // es que el gate de PR no debe fallar por drift pre-existente).
      for (const f of findings) f.isRegression = false;
      console.error("[catalog-diff] baseline indeterminado → gate report-only (no falla).");
      gate = { regressions: 0, baselineMode: true, mode: "report-only" };
    }
  } else {
    gate = { ...markRegressions(findings, null), mode: "absolute" };
  }

  const meta = {
    date: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    catalogFile: path.relative(REPO_ROOT, catalogFile),
    catalogCount: catalogByPath.size,
    matrizSource: source,
    matrizRows: matriz.rows.length,
    gate,
    cfg,
  };

  if (args.json) {
    console.log(JSON.stringify({ ok: true, summary, gate, meta: { ...meta, cfg: undefined, gate: undefined }, findings }, null, 2));
  } else {
    const md = renderMarkdown({ findings, summary }, meta);
    if (args.out) {
      const outPath = path.resolve(process.cwd(), args.out);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, md, "utf8");
      console.error(`[catalog-diff] Reporte → ${args.out}`);
    }
    console.log(md);
  }

  // El gate (lo que decide el exit code) son las regresiones en modo PR, o todos
  // los S1 en modo absoluto/cron.
  const gateCount = gate.regressions;
  console.error(`[catalog-diff] mode=${gate.mode} gate=${gateCount} S1=${summary.s1} WARN=${summary.bySeverity.warn || 0} total=${summary.total}`);
  if (gateCount > 0 && !soft) process.exit(1);
  process.exit(0);
}

// Sólo corre el CLI cuando se ejecuta directamente (no al importarlo en tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
