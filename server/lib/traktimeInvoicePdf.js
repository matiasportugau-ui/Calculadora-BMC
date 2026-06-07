/**
 * TraKtiMe — invoice PDF rendering + GCS upload.
 *
 * Renders the Spanish-language invoice HTML template via Chromium (same
 * pipeline as server/routes/pdf.js), then uploads the PDF buffer to GCS and
 * returns the public URL. Gracefully degrades:
 *   - If Chromium binary is missing → returns { pdfBuffer: null, url: null }.
 *     Caller still mints the invoice number and stores no pdf_url; user can
 *     re-issue once renderer is wired.
 *   - If GCS bucket is not configured → returns { pdfBuffer, url: null }.
 *
 * Serialization: in-process module-level promise queue limits concurrent
 * Chromium spawns to 1 — admin mass-issue won't OOM Cloud Run.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, "../../src/pdf-templates/traktimeInvoice.html");

let renderQueue = Promise.resolve();

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtUsd(n) {
  return `USD ${Number(n || 0).toFixed(2)}`;
}

function fmtDateUy(d) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(date.getUTCFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/** Build the rendered HTML string for an invoice payload. */
export function renderInvoiceHtml({ invoice, client, lines, entries, issuer, terms }) {
  let template;
  try {
    template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  } catch {
    template = "<html><body>Template not found</body></html>";
  }

  const linesHtml = lines
    .map((l) => {
      const lineEntries = entries.filter((e) => e.project_id === l.project_id);
      const rows = lineEntries
        .map(
          (e) => `
            <tr>
              <td>${escapeHtml(fmtDateUy(e.started_at))}</td>
              <td>${escapeHtml(e.description || "")}</td>
              <td class="num">${(Number(e.duration_seconds || 0) / 3600).toFixed(2)}h</td>
            </tr>`,
        )
        .join("");
      return `
        <section class="project">
          <h3>
            <span class="dot" style="background:${escapeHtml(l.color_hex || "#0071e3")}"></span>
            ${escapeHtml(l.description)}
          </h3>
          <table class="entries">
            <thead><tr><th>Fecha</th><th>Detalle</th><th class="num">Horas</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="subtotal">
            ${Number(l.hours).toFixed(2)}h × USD ${Number(l.hourly_rate_usd).toFixed(2)}
            &nbsp;=&nbsp; <strong>${fmtUsd(l.amount_usd)}</strong>
          </div>
        </section>`;
    })
    .join("");

  return template
    .replaceAll("{{invoice_number}}", escapeHtml(invoice.number || "DRAFT"))
    .replaceAll("{{issue_date}}", escapeHtml(fmtDateUy(invoice.issue_date)))
    .replaceAll("{{due_date}}", escapeHtml(fmtDateUy(invoice.due_date)))
    .replaceAll("{{issuer_name}}", escapeHtml(issuer.name))
    .replaceAll("{{issuer_rut}}", escapeHtml(issuer.rut))
    .replaceAll("{{issuer_address}}", escapeHtml(issuer.address))
    .replaceAll("{{client_name}}", escapeHtml(client.name))
    .replaceAll("{{client_rut}}", escapeHtml(client.rut || ""))
    .replaceAll("{{client_address}}", escapeHtml(client.address || ""))
    .replaceAll("{{lines_html}}", linesHtml)
    .replaceAll("{{subtotal_usd}}", fmtUsd(invoice.subtotal_usd))
    .replaceAll("{{iva_rate_pct}}", String(Math.round(Number(invoice.iva_rate) * 100)))
    .replaceAll("{{iva_usd}}", fmtUsd(invoice.iva_usd))
    .replaceAll("{{total_usd}}", fmtUsd(invoice.total_usd))
    .replaceAll("{{terms}}", escapeHtml(terms));
}

/**
 * Render HTML to a PDF buffer using @sparticuz/chromium + puppeteer-core.
 * Returns null if the Chromium binary is unavailable.
 */
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
        margin: { top: "20mm", right: "16mm", bottom: "20mm", left: "16mm" },
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
    const file = storage.bucket(bucket).file(`traktime-invoices/${filename}`);
    await file.save(buffer, {
      contentType: "application/pdf",
      resumable: false,
    });
    return `https://storage.googleapis.com/${bucket}/traktime-invoices/${encodeURIComponent(filename)}`;
  } catch {
    return null;
  }
}

/**
 * Render and upload. Returns { pdfBuffer, url }. Either may be null if the
 * renderer or bucket is unavailable — the caller decides how to proceed.
 */
export async function renderAndUploadInvoice({ invoice, client, lines, entries, issuer, terms, bucket }) {
  const html = renderInvoiceHtml({ invoice, client, lines, entries, issuer, terms });
  const pdfBuffer = await renderHtmlToPdfBuffer(html).catch(() => null);
  if (!pdfBuffer) return { pdfBuffer: null, url: null };
  const filename = `${invoice.number || invoice.invoice_id}.pdf`;
  const url = await uploadPdfToGcs(bucket, filename, pdfBuffer);
  return { pdfBuffer, url };
}
