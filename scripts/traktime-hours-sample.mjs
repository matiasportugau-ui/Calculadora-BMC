/**
 * Generate a sample TraKtiMe monthly hours-report PDF (synthetic data) for PR
 * review. No DB, no network. Renders to PDF if a Chromium binary is available;
 * always writes the HTML alongside.
 *
 * Run: node scripts/traktime-hours-sample.mjs
 * Output: audit-output/traktime-hours-sample.{html,pdf}
 */
import fs from "node:fs";
import path from "node:path";
import { buildJornadaReport } from "../server/lib/traktimeJornada.js";
import { renderHoursReportHtml, renderAndUploadHoursReport } from "../server/lib/traktimeHoursPdf.js";

function uy(date, hhmm) {
  return `${date}T${hhmm}:00-03:00`;
}
function entry(date, start, end, project_name, color_hex, client_name = "Cliente Demo SA") {
  const s = new Date(uy(date, start)).getTime();
  const e = new Date(uy(date, end)).getTime();
  return {
    started_at: uy(date, start),
    stopped_at: uy(date, end),
    duration_seconds: Math.round((e - s) / 1000),
    project_id: project_name,
    project_name,
    client_name,
    color_hex,
  };
}

// Synthetic month: includes Ramiro's exact fixture day plus a day with a pausa.
const entries = [
  // 11/06 — Ramiro fixture: effective 2h54m, coordinación 6m, jornada 3h00m
  entry("2026-06-11", "09:00", "10:30", "Obra Carrasco", "#0071e3"),
  entry("2026-06-11", "10:33", "11:15", "Obra Carrasco", "#0071e3"),
  entry("2026-06-11", "11:18", "12:00", "Coordinación general", "#34c759"),
  // 12/06 — a normal day with a long lunch (pausa over 30 min)
  entry("2026-06-12", "08:30", "12:00", "Obra Pocitos", "#ff9500"),
  entry("2026-06-12", "13:00", "17:15", "Obra Pocitos", "#ff9500"),
  // 13/06 — short day, two back-to-back tasks (coordinación micro-gap)
  entry("2026-06-13", "09:00", "11:00", "Relevamiento", "#af52de"),
  entry("2026-06-13", "11:05", "12:30", "Relevamiento", "#af52de"),
];

const report = buildJornadaReport(entries, {});
const month = "2026-06";
const user = { id: "demo", name: "Ramiro (demo)", email: "ramiro@example.com" };
const issuer = { name: "METALOG SAS — BMC Uruguay" };

const outDir = path.resolve("audit-output");
fs.mkdirSync(outDir, { recursive: true });
const htmlPath = path.join(outDir, "traktime-hours-sample.html");
fs.writeFileSync(htmlPath, renderHoursReportHtml({ report, user, month, issuer }), "utf8");
console.log("Totals:", JSON.stringify(report.totals, null, 2));
console.log("HTML →", htmlPath);

const { pdfBuffer } = await renderAndUploadHoursReport({ report, user, month, issuer, bucket: null });
if (pdfBuffer) {
  const pdfPath = path.join(outDir, "traktime-hours-sample.pdf");
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log("PDF  →", pdfPath, `(${pdfBuffer.length} bytes)`);
} else {
  console.log("PDF  → skipped (Chromium binary unavailable in this environment)");
}
