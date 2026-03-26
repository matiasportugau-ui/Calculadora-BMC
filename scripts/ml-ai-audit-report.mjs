#!/usr/bin/env node
/**
 * Auditoría automática Mercado Libre: descarga todas las preguntas y órdenes vía API local,
 * agrega estadísticas en JS y genera un informe en Markdown usando el primer modelo de IA
 * disponible (misma cadena que /api/crm/suggest-response: grok → claude → openai → gemini).
 *
 * Requisitos: npm run start:api + OAuth ML válido.
 *
 * Uso:
 *   npm run ml:ai-audit
 *   BMC_API_BASE=http://127.0.0.1:3001 node scripts/ml-ai-audit-report.mjs
 *   node scripts/ml-ai-audit-report.mjs --dry-run   # solo JSON agregado + sin IA
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "../server/config.js";
import { callAiCompletion } from "../server/lib/aiCompletion.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const DEFAULT_BASE = process.env.BMC_API_BASE || `http://127.0.0.1:${config.port}`;

function parseArgs(argv) {
  const out = { dryRun: false, base: DEFAULT_BASE };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--dry-run") out.dryRun = true;
    if (argv[i] === "--base") out.base = argv[++i] ?? DEFAULT_BASE;
    if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(`Usage: node scripts/ml-ai-audit-report.mjs [--dry-run] [--base URL]`);
      process.exit(0);
    }
  }
  return out;
}

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON ${res.status} from ${url}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}: ${text.slice(0, 300)}`);
  }
  return json;
}

async function fetchAllQuestions(base) {
  const limit = 50;
  let offset = 0;
  const all = [];
  let total = null;
  for (let i = 0; i < 200; i++) {
    const u = new URL("/ml/questions", base);
    u.searchParams.set("limit", String(limit));
    u.searchParams.set("offset", String(offset));
    const j = await fetchJson(u.toString());
    const qs = j.questions || [];
    if (total == null && j.total != null) total = j.total;
    all.push(...qs);
    if (qs.length < limit) break;
    offset += limit;
    if (total != null && all.length >= total) break;
  }
  return { questions: all, totalReported: total };
}

async function fetchAllOrders(base) {
  const limit = 50;
  let offset = 0;
  const all = [];
  let total = null;
  for (let i = 0; i < 200; i++) {
    const u = new URL("/ml/orders", base);
    u.searchParams.set("limit", String(limit));
    u.searchParams.set("offset", String(offset));
    const j = await fetchJson(u.toString());
    const rows = j.results || [];
    if (total == null && j.paging?.total != null) total = j.paging.total;
    all.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
    if (total != null && all.length >= total) break;
  }
  return { orders: all, totalReported: total };
}

function countBy(arr, keyFn) {
  const m = Object.create(null);
  for (const x of arr) {
    const k = keyFn(x);
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function aggregateQuestions(questions) {
  const byStatus = countBy(questions, (q) => q.status || "UNKNOWN");
  const answered = questions.filter((q) => q.status === "ANSWERED").length;
  const withText = questions.filter((q) => (q.text || "").trim().length > 0).length;
  let minDate = null;
  let maxDate = null;
  for (const q of questions) {
    const d = q.date_created ? Date.parse(q.date_created) : NaN;
    if (!Number.isNaN(d)) {
      if (minDate == null || d < minDate) minDate = d;
      if (maxDate == null || d > maxDate) maxDate = d;
    }
  }
  return {
    count: questions.length,
    byStatus,
    answered,
    withBuyerText: withText,
    dateFirst: minDate ? new Date(minDate).toISOString() : null,
    dateLast: maxDate ? new Date(maxDate).toISOString() : null,
  };
}

function aggregateOrders(orders) {
  const byStatus = countBy(orders, (o) => o.status || "UNKNOWN");
  const fulfilled = orders.filter((o) => o.fulfilled === true).length;
  const withShipping = orders.filter((o) => o.shipping?.id).length;
  return {
    count: orders.length,
    byStatus,
    fulfilledCount: fulfilled,
    withShippingId: withShipping,
  };
}

/** Muestra estratificada: primeras 5, medias 5, últimas 5 por date_created */
function sampleQuestions(questions, each = 5) {
  const sorted = [...questions].sort(
    (a, b) => Date.parse(a.date_created || 0) - Date.parse(b.date_created || 0)
  );
  const n = sorted.length;
  if (n === 0) return [];
  const pick = new Set();
  const take = (arr, from, len) => {
    for (let i = from; i < Math.min(from + len, arr.length); i++) pick.add(arr[i].id);
  };
  take(sorted, 0, Math.min(each, n));
  const mid = Math.max(0, Math.floor(n / 2) - Math.floor(each / 2));
  take(sorted, mid, each);
  take(sorted, Math.max(0, n - each), each);
  return sorted.filter((q) => pick.has(q.id)).map((q) => ({
    id: q.id,
    status: q.status,
    item_id: q.item_id,
    date_created: q.date_created,
    buyer_text: (q.text || "").replace(/\s+/g, " ").trim().slice(0, 280),
    has_seller_answer: Boolean(q.answer?.text),
  }));
}

function sampleOrders(orders, max = 8) {
  const sorted = [...orders].sort(
    (a, b) => Date.parse(b.date_created || 0) - Date.parse(a.date_created || 0)
  );
  return sorted.slice(0, max).map((o) => ({
    id: o.id,
    status: o.status,
    fulfilled: o.fulfilled,
    date_created: o.date_created,
    total: o.total,
    currency_id: o.currency_id,
    buyer_nickname: o.buyer?.nickname,
    tags: o.tags,
  }));
}

function buildSystemPrompt() {
  return `Sos analista de operaciones y marketplace para BMC Uruguay (METALOG SAS), vendedor de paneles isopanel en Mercado Libre Uruguay.

Tu tarea: interpretar datos AGREGADOS y MUESTRAS (preguntas de compradores y órdenes) y redactar un informe útil para dirección y ventas.

Reglas:
- Respondé en español rioplatense, tono profesional.
- No inventes cifras que no estén en el JSON.
- Si falta dato, decilo.
- Incluí recomendaciones accionables (preguntas sin responder, cuellos de botella, oportunidades).
- Mercado Libre: mencioná buenas prácticas (tiempo de respuesta, claridad, reputación) sin citar legales como abogado.
- Salida: SOLO Markdown bien estructurado, sin bloque de código que envuelva todo el documento.`;
}

function buildUserPayload(stats) {
  return [
    "## Datos para analizar",
    "",
    "### Agregados preguntas (API /ml/questions)",
    "```json",
    JSON.stringify(stats.questionsAgg, null, 2),
    "```",
    "",
    "### Agregados órdenes (API /ml/orders)",
    "```json",
    JSON.stringify(stats.ordersAgg, null, 2),
    "```",
    "",
    "### Muestra de preguntas (texto comprador truncado; diversas fechas)",
    "```json",
    JSON.stringify(stats.questionSamples, null, 2),
    "```",
    "",
    "### Muestra reciente de órdenes",
    "```json",
    JSON.stringify(stats.orderSamples, null, 2),
    "```",
    "",
    "### Instrucción",
    "Generá el informe con secciones:",
    "",
    "1. Resumen ejecutivo (5–8 líneas)",
    "2. Preguntas ML: volumen, estados, posibles riesgos de SLA o backlog",
    "3. Órdenes ML: lectura del flujo (pagos, envío, fulfilled), coherencia con tags",
    "4. Relación cualitativa consultas → operación (sin afirmar causalidad fuerte)",
    "5. Recomendaciones priorizadas (máx. 7 bullets)",
    "6. Checklist operativo próximos 7 días",
    "",
  ].join("\n");
}

async function main() {
  const opts = parseArgs(process.argv);
  const base = opts.base.replace(/\/$/, "");

  console.error(`ML AI audit — API base: ${base}`);

  const qData = await fetchAllQuestions(base);
  const oData = await fetchAllOrders(base);

  const questionsAgg = aggregateQuestions(qData.questions);
  const ordersAgg = aggregateOrders(oData.orders);

  const stats = {
    fetchedAt: new Date().toISOString(),
    apiBase: base,
    questionsTotalReported: qData.totalReported,
    ordersTotalReported: oData.totalReported,
    questionsAgg,
    ordersAgg,
    questionSamples: sampleQuestions(qData.questions, 5),
    orderSamples: sampleOrders(oData.orders, 10),
  };

  const reportsDir = path.join(REPO_ROOT, "docs/team/panelsim/reports");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const jsonPath = path.join(reportsDir, `ML-AI-AUDIT-DATA-${stamp}.json`);
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(stats, null, 2), "utf8");
  console.error(`Wrote aggregate JSON: ${jsonPath}`);

  if (opts.dryRun) {
    console.log(`Dry run — no AI. Data: ${jsonPath}`);
    return;
  }

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserPayload(stats);

  console.error("Calling AI (provider chain)…");
  const { text, provider } = await callAiCompletion({
    systemPrompt,
    userMessage,
    maxTokens: 4096,
  });

  const header = [
    `# ML — Informe automático (IA)`,
    ``,
    `**Generado:** ${new Date().toISOString()}`,
    `**API:** ${base}`,
    `**Modelo usado:** ${provider}`,
    `**Datos agregados:** \`${path.relative(REPO_ROOT, jsonPath)}\``,
    ``,
    `---`,
    ``,
  ].join("\n");

  const mdPath = path.join(reportsDir, `ML-AI-AUDIT-REPORT-${stamp}.md`);
  fs.writeFileSync(mdPath, header + text + "\n", "utf8");
  console.error(`Wrote report: ${mdPath}`);
  console.log(mdPath);
}

main().catch((err) => {
  console.error(err.message || err);
  if (err.details) console.error(err.details.join("\n"));
  process.exit(1);
});
