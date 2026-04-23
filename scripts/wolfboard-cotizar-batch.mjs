#!/usr/bin/env node
/**
 * wolfboard-cotizar-batch.mjs
 *
 * Lee las filas pendientes del Admin 2.0 (WOLFB_ADMIN_SHEET_ID),
 * calcula precios exactos para las que tienen dimensiones suficientes
 * usando la tabla de precios de constants.js, y graba la respuesta en col J.
 *
 * Uso:
 *   npm run wolfboard:cotizar          # solo filas sin respuesta
 *   npm run wolfboard:cotizar -- --force  # re-procesa todas las pendientes
 *
 * Para batch IA (requiere ANTHROPIC_API_KEY y API corriendo):
 *   npm run wolfboard:batch-ia
 */

import { google } from "googleapis";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// ── Precios web (USD/m² s/IVA) y ancho útil por familia ───────────────────
const PANEL_DATA = {
  ISOROOF_3G:    { au: 1.00, label: "ISOROOF 3G",    precios: { 30: 48.63, 40: 51.10, 50: 53.56, 80: 62.98, 100: 69.15 } },
  ISOROOF_FOIL:  { au: 1.00, label: "ISOROOF FOIL 3G", precios: { 30: 39.40, 50: 44.66 } },
  ISODEC_EPS:    { au: 1.12, label: "ISODEC EPS",    precios: { 80: 37.79, 100: 45.97, 150: 51.71, 200: 57.99, 250: 63.74 } },
  ISODEC_PIR:    { au: 1.12, label: "ISODEC PIR",    precios: { 50: 50.91, 80: 52.04, 120: 62.55 } },
  ISOPANEL_EPS:  { au: 1.14, label: "ISOPANEL EPS",  precios: { 50: 41.79, 100: 45.97, 150: 51.71, 200: 57.99, 250: 63.74 } },
  ISOWALL_PIR:   { au: 1.14, label: "ISOWALL PIR",   precios: { 50: 54.54, 80: 65.03, 100: 71.71 } },
};

const IVA = 0.22;
const SHEET_ID = process.env.WOLFB_ADMIN_SHEET_ID || "1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0";
const ADMIN_TAB = process.env.WOLFB_ADMIN_TAB || "Admin.";
const SA_FILE   = path.join(ROOT, "docs/bmc-dashboard-modernization/service-account.json");
const FORCE     = process.argv.includes("--force");

// ── Detección de producto/dimensiones desde texto libre ───────────────────
function detectarFamilia(texto) {
  const t = texto.toLowerCase();
  if (/isoroof\s*foil|foil/i.test(t))        return "ISOROOF_FOIL";
  if (/isoroof|3\s*greca/i.test(t))           return "ISOROOF_3G";
  if (/isodec.*pir|pir.*isodec/i.test(t))     return "ISODEC_PIR";
  if (/isodec/i.test(t))                      return "ISODEC_EPS";
  if (/isowall/i.test(t))                     return "ISOWALL_PIR";
  if (/isopanel/i.test(t))                    return "ISOPANEL_EPS";
  return null;
}

function detectarEspesor(texto) {
  const m = texto.match(/(\d{2,3})\s*mm/i);
  return m ? parseInt(m[1], 10) : null;
}

function detectarPaneles(texto) {
  // "9 paneles", "11p", "13 paneles", "10 x paneles"
  const m = texto.match(/(\d+)\s*[xX×]?\s*paneles?|(\d+)\s*p\b/i);
  return m ? parseInt(m[1] || m[2], 10) : null;
}

function detectarLargo(texto) {
  // "8,90 metros", "3.35m", "8.90 m"
  const m = texto.match(/(\d+)[,.](\d+)\s*m(?:etros?)?/i) || texto.match(/(\d+)\s*m(?:etros?)?/i);
  if (!m) return null;
  if (m[2] !== undefined) return parseFloat(`${m[1]}.${m[2]}`);
  return parseFloat(m[1]);
}

function fmt(n) { return n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function generarRespuesta(row) {
  const consulta = (row.consulta || "").trim();
  if (!consulta || consulta.length < 15) return null;

  const familia = detectarFamilia(consulta);
  if (!familia) return null;

  const esp    = detectarEspesor(consulta);
  const paneles = detectarPaneles(consulta);
  const largo  = detectarLargo(consulta);

  const pd = PANEL_DATA[familia];
  if (!pd) return null;

  // Encontrar espesor más cercano disponible
  const espKey = esp
    ? Object.keys(pd.precios).map(Number).sort((a, b) => Math.abs(a - esp) - Math.abs(b - esp))[0]
    : parseInt(Object.keys(pd.precios)[0], 10);

  const precioM2 = pd.precios[espKey];
  if (!precioM2) return null;

  // Necesitamos paneles + largo para calcular
  if (!paneles || !largo) return null;

  const au = pd.au;
  const area = +(paneles * au * largo).toFixed(2);
  const subtotal = +(area * precioM2).toFixed(2);
  const iva = +(subtotal * IVA).toFixed(2);
  const total = +(subtotal + iva).toFixed(2);

  const nombre = (row.cliente || "").split(/\s/)[0] || "cliente";
  const espNote = esp && esp !== espKey ? ` (espesor ajustado a ${espKey} mm disponible)` : "";

  return [
    `Buenas ${nombre}! Para ${paneles} paneles ${pd.label} ${espKey} mm, de ${largo.toString().replace(".", ",")} m de largo${espNote}:`,
    ``,
    `• Superficie: ${fmt(area)} m² (${paneles} × ${au.toFixed(2)} m × ${largo.toString().replace(".", ",")} m)`,
    `• Precio lista web: U$S ${fmt(precioM2)}/m² s/IVA`,
    `• Subtotal s/IVA: U$S ${fmt(subtotal)}`,
    `• IVA 22%: U$S ${fmt(iva)}`,
    `• Total c/IVA: U$S ${fmt(total)}`,
    ``,
    `Precio sin flete. Cualquier consulta, avisanos.`,
  ].join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: SA_FILE, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });

  console.log(`\n📋 Leyendo Admin tab "${ADMIN_TAB}"…`);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${ADMIN_TAB}'!A2:L`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = (res.data.values || []).map((row, i) => ({
    rowNum: i + 2,
    estado:   (row[2] || "").trim(),
    cliente:  (row[4] || "").trim(),
    origen:   (row[5] || "").trim(),
    consulta: (row[8] || "").trim(),
    respuesta:(row[9] || "").trim(),
    link:     (row[10] || "").trim(),
  })).filter(r => r.consulta && r.estado.toLowerCase().includes("pendiente"));

  console.log(`   ${rows.length} filas pendientes encontradas.\n`);

  const updates = [];
  let skipped = 0;

  for (const row of rows) {
    const yaResuelta = row.respuesta && !row.respuesta.includes("⚠") && !row.respuesta.includes("Requiere");
    if (yaResuelta && !FORCE) {
      console.log(`  ⏭  Fila ${row.rowNum} (${row.cliente}) — ya tiene respuesta, omitida`);
      skipped++;
      continue;
    }

    const resp = generarRespuesta(row);
    if (!resp) {
      console.log(`  ❓ Fila ${row.rowNum} (${row.cliente}) — sin dimensiones suficientes para calcular`);
      skipped++;
      continue;
    }

    updates.push({ rowNum: row.rowNum, cliente: row.cliente, respuesta: resp });
  }

  if (updates.length === 0) {
    console.log(`\nNada nuevo que grabar (${skipped} omitidas). Usá --force para re-procesar.\n`);
    return;
  }

  console.log(`\n✍️  Grabando ${updates.length} respuestas al sheet…\n`);

  for (const u of updates) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `'${ADMIN_TAB}'!J${u.rowNum}`,
      valueInputOption: "RAW",
      requestBody: { values: [[u.respuesta]] },
    });
    console.log(`  ✅ Fila ${u.rowNum} (${u.cliente})\n${u.respuesta.split("\n").slice(0, 3).map(l => "     " + l).join("\n")}\n`);
  }

  console.log(`\n✔  ${updates.length} cotizaciones grabadas · ${skipped} omitidas.\n`);
  console.log(`   Abrí /hub/admin en la app para revisar y aprobar.\n`);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
