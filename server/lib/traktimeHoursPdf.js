/**
 * TraKtiMe — monthly HOURS report PDF (for administración / Sandra).
 *
 * Distinct from the INVOICE PDF (server/lib/traktimeInvoicePdf.js): this one
 * reports time, not money — per-day jornada with effective time, coordinación,
 * pausa and span, plus monthly totals and a per-client/project rollup.
 *
 * The Chromium render + GCS upload pipeline is intentionally COPIED from the
 * invoice module (per scope: do not modify the invoice file). Same graceful
 * degradation:
 *   - Chromium binary missing → { pdfBuffer: null, url: null }.
 *   - GCS bucket not configured → { pdfBuffer, url: null }.
 *
 * The HTML builder renders cleanly with ZERO entries (empty month) — it never
 * assumes at least one day exists.
 */
import fs from "node:fs";

let renderQueue = Promise.resolve();

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Seconds → "Hh Mm" (e.g. 10440 → "2h 54m"). */
export function fmtHm(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function fmtMonthEs(month) {
  // month: "YYYY-MM"
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!m) return String(month || "");
  const names = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const idx = Number(m[2]) - 1;
  return `${names[idx] || m[2]} ${m[1]}`;
}

/**
 * Build the self-contained HTML for an hours report.
 * @param {{ report:object, user:object, month:string, issuer:object }} payload
 */
export function renderHoursReportHtml({ report, user, month, issuer }) {
  const days = report?.days || [];
  const totals = report?.totals || {
    effective_seconds: 0,
    coordinacion_seconds: 0,
    pausa_seconds: 0,
    jornada_seconds: 0,
    idle_seconds: 0,
    day_count: 0,
  };
  const projects = report?.projects || [];

  const dayRows = days.length
    ? days
        .map(
          (d) => `
            <tr>
              <td>${escapeHtml(d.date)}</td>
              <td class="num">${escapeHtml(d.first_in_local || "—")}</td>
              <td class="num">${escapeHtml(d.last_out_local || "—")}</td>
              <td class="num">${escapeHtml(fmtHm(d.effective_seconds))}</td>
              <td class="num">${escapeHtml(fmtHm(d.coordinacion_seconds))}</td>
              <td class="num">${escapeHtml(fmtHm(d.pausa_seconds))}</td>
              <td class="num strong">${escapeHtml(fmtHm(d.jornada_seconds))}</td>
            </tr>`,
        )
        .join("")
    : `<tr><td colspan="7" class="empty">Sin registros en el período.</td></tr>`;

  const projectRows = projects.length
    ? projects
        .map(
          (p) => `
            <tr>
              <td><span class="dot" style="background:${escapeHtml(p.color_hex || "#8e8e93")}"></span>${escapeHtml(p.project_name || "—")}</td>
              <td>${escapeHtml(p.client_name || "—")}</td>
              <td class="num">${escapeHtml(String(p.entry_count || 0))}</td>
              <td class="num strong">${escapeHtml(fmtHm(p.effective_seconds))}</td>
            </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="empty">—</td></tr>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Reporte de Horas ${escapeHtml(fmtMonthEs(month))}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Helvetica, Arial, sans-serif;
    color: #1d1d1f; font-size: 11pt; margin: 0; padding: 22mm 18mm; line-height: 1.4;
  }
  header { display: flex; justify-content: space-between; align-items: flex-end;
    border-bottom: 2px solid #1d1d1f; padding-bottom: 12px; margin-bottom: 18px; }
  .h-left h1 { font-size: 20pt; margin: 0; font-weight: 600; letter-spacing: -0.02em; }
  .h-left .meta { color: #6e6e73; font-size: 10pt; margin-top: 4px; }
  .h-right { text-align: right; font-size: 10pt; color: #6e6e73; }
  .h-right .who { font-size: 12pt; color: #1d1d1f; font-weight: 600; }
  h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.04em; color: #6e6e73;
    margin: 24px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th, td { padding: 5px 8px; text-align: left; border-bottom: 1px solid #f0f0f2; vertical-align: top; }
  th { font-weight: 600; color: #6e6e73; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.04em; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .strong { font-weight: 700; color: #1d1d1f; }
  .empty { text-align: center; color: #6e6e73; padding: 16px; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  tfoot td { border-top: 2px solid #1d1d1f; font-weight: 700; }
  .cards { display: flex; gap: 12px; margin: 4px 0 8px; }
  .kpi { flex: 1; border: 1px solid #e5e5ea; border-radius: 10px; padding: 10px 12px; }
  .kpi .label { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; color: #6e6e73; }
  .kpi .value { font-size: 15pt; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 2px; }
  footer { margin-top: 32px; padding-top: 10px; border-top: 1px solid #e5e5ea; color: #6e6e73; font-size: 8.5pt; }
</style>
</head>
<body>
  <header>
    <div class="h-left">
      <h1>Reporte de Horas</h1>
      <div class="meta">${escapeHtml(fmtMonthEs(month))}</div>
    </div>
    <div class="h-right">
      <div class="who">${escapeHtml(user?.name || user?.email || "Usuario")}</div>
      <div>${escapeHtml(user?.email || "")}</div>
      <div>${escapeHtml(issuer?.name || "")}</div>
    </div>
  </header>

  <div class="cards">
    <div class="kpi"><div class="label">Efectivo</div><div class="value">${escapeHtml(fmtHm(totals.effective_seconds))}</div></div>
    <div class="kpi"><div class="label">Coordinación</div><div class="value">${escapeHtml(fmtHm(totals.coordinacion_seconds))}</div></div>
    <div class="kpi"><div class="label">Pausa</div><div class="value">${escapeHtml(fmtHm(totals.pausa_seconds))}</div></div>
    <div class="kpi"><div class="label">Jornada</div><div class="value">${escapeHtml(fmtHm(totals.jornada_seconds))}</div></div>
  </div>

  <h2>Detalle por día (${escapeHtml(String(totals.day_count || 0))} días)</h2>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th class="num">Entrada</th>
        <th class="num">Salida</th>
        <th class="num">Efectivo</th>
        <th class="num">Coordinación</th>
        <th class="num">Pausa</th>
        <th class="num">Jornada</th>
      </tr>
    </thead>
    <tbody>${dayRows}</tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num">${escapeHtml(fmtHm(totals.effective_seconds))}</td>
        <td class="num">${escapeHtml(fmtHm(totals.coordinacion_seconds))}</td>
        <td class="num">${escapeHtml(fmtHm(totals.pausa_seconds))}</td>
        <td class="num">${escapeHtml(fmtHm(totals.jornada_seconds))}</td>
      </tr>
    </tfoot>
  </table>

  <h2>Por cliente / proyecto</h2>
  <table>
    <thead>
      <tr><th>Proyecto</th><th>Cliente</th><th class="num">Entradas</th><th class="num">Efectivo</th></tr>
    </thead>
    <tbody>${projectRows}</tbody>
  </table>

  <footer>
    Reporte de horas generado automáticamente por TraKtiMe. Tiempo efectivo = suma de tareas
    registradas. Coordinación = micro-pausas entre tareas (≤ umbral). Pausa = interrupciones
    sobre el umbral. Jornada = desde el inicio de la primera tarea hasta el fin de la última.
  </footer>
</body>
</html>`;
}

/** Render HTML → PDF buffer via @sparticuz/chromium + puppeteer-core. */
async function renderHtmlToPdfBuffer(html) {
  const result = renderQueue.then(async () => {
    let chromium, puppeteer;
    try {
      chromium = (await import("@sparticuz/chromium")).default;
      puppeteer = (await import("puppeteer-core")).default;
    } catch {
      return null;
    }
    const executablePath =
      process.env.CHROMIUM_EXECUTABLE_PATH || (await chromium.executablePath());
    if (!executablePath || !fs.existsSync(executablePath)) return null;

    const useSystemBinary = !!process.env.CHROMIUM_EXECUTABLE_PATH;
    const launchArgs = useSystemBinary
      ? ["--headless=new", "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
      : chromium.args;

    let browser;
    try {
      browser = await puppeteer.launch({
        args: launchArgs,
        executablePath,
        headless: useSystemBinary ? true : chromium.headless,
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const buf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "18mm", right: "16mm", bottom: "18mm", left: "16mm" },
      });
      return buf;
    } finally {
      if (browser) await browser.close().catch(() => {});
    }
  });
  renderQueue = result.catch(() => {});
  return result;
}

async function uploadPdfToGcs(bucket, filename, buffer) {
  if (!bucket || !buffer) return null;
  try {
    const { Storage } = await import("@google-cloud/storage");
    const storage = new Storage();
    const file = storage.bucket(bucket).file(`traktime-hours/${filename}`);
    await file.save(buffer, { contentType: "application/pdf", resumable: false });
    return `https://storage.googleapis.com/${bucket}/traktime-hours/${encodeURIComponent(filename)}`;
  } catch {
    return null;
  }
}

/**
 * Render + upload the monthly hours report.
 * @returns {Promise<{ pdfBuffer: Buffer|null, url: string|null, html: string }>}
 */
export async function renderAndUploadHoursReport({ report, user, month, issuer, bucket }) {
  const html = renderHoursReportHtml({ report, user, month, issuer });
  const pdfBuffer = await renderHtmlToPdfBuffer(html).catch(() => null);
  if (!pdfBuffer) return { pdfBuffer: null, url: null, html };
  const safeUser = String(user?.id || user?.email || "user").replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `horas-${month}-${safeUser}.pdf`;
  const url = await uploadPdfToGcs(bucket, filename, pdfBuffer);
  return { pdfBuffer, url, html };
}
