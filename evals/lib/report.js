import fs from "node:fs";
import path from "node:path";

function fmtMoney(v) {
  if (v == null) return "n/d";
  return `USD ${Number(v).toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderTotals(totales) {
  if (!totales) return "_(sin totales)_";
  return [
    `- Subtotal sin IVA: ${fmtMoney(totales.subtotalSinIVA)}`,
    `- IVA 22%: ${fmtMoney(totales.iva)}`,
    `- Total con IVA: ${fmtMoney(totales.totalFinal)}`,
  ].join("\n");
}

function renderBomTable(items = []) {
  if (!items.length) return "_(BOM vacío)_";
  const rows = items.map((it) => {
    const desc = it.label || it.desc || "—";
    const qty = it.cant ?? "—";
    const unit = it.unidad || "";
    const pu = it.pu ?? null;
    const total = it.total ?? null;
    return `| ${desc} | ${qty} ${unit} | ${pu != null ? fmtMoney(pu) : "—"} | ${total != null ? fmtMoney(total) : "—"} |`;
  });
  return ["| Item | Cant | P/U | Subt |", "|---|---|---|---|", ...rows].join("\n");
}

function renderComparison(cmp) {
  if (!cmp) return "_(sin comparación)_";
  if (cmp.status === "no_golden") return `_${cmp.reason || "Golden no disponible"}_`;
  const lines = [`**Status:** ${cmp.status}`];
  if (cmp.totals?.checks?.length) {
    lines.push("", "**Totales:**");
    for (const c of cmp.totals.checks) {
      const icon = c.ok ? "✓" : "✗";
      lines.push(`- ${icon} ${c.kind}: gen=${fmtMoney(c.generated)}, gold=${fmtMoney(c.golden)} (diff=${c.diff != null ? fmtMoney(c.diff) : "—"}, ${c.tolerance})`);
    }
  }
  if (cmp.bom?.checks?.length) {
    lines.push("", `**BOM:** ${cmp.bom.matches}/${cmp.bom.total} matches`);
    for (const c of cmp.bom.checks) {
      const icon = c.ok ? "✓" : "✗";
      if (c.kind === "bom_missing") {
        lines.push(`- ${icon} FALTA en generado: ${c.desc} (golden qty=${c.golden_qty})`);
      } else {
        lines.push(`- ${icon} ${c.desc}: gen=${c.generated_qty}, gold=${c.golden_qty}`);
      }
    }
  }
  return lines.join("\n");
}

export function buildCaseReport(caseData, runResult, comparison) {
  const lines = [];
  lines.push(`# Reporte — ${caseData.case_id}`);
  lines.push("");
  lines.push(`- **Fila planilla:** ${caseData.fila_planilla ?? "—"}`);
  lines.push(`- **Cliente:** ${caseData.inputs_raw?.cliente ?? "—"}`);
  lines.push(`- **Fecha:** ${caseData.inputs_raw?.fecha ?? "—"}`);
  lines.push(`- **Consulta:** ${caseData.inputs_raw?.consulta ?? "—"}`);
  lines.push(`- **Lista:** ${runResult.lista}`);
  lines.push(`- **Generado:** ${runResult.generated_at}`);
  lines.push("");

  for (let i = 0; i < runResult.opciones_resultados.length; i++) {
    const op = runResult.opciones_resultados[i];
    const cmp = comparison?.perOpcion?.[i];
    lines.push(`## Opción ${i + 1}: ${op.label}`);
    lines.push("");
    if (op.result.error) {
      lines.push(`> ERROR: ${op.result.error}`);
      lines.push("");
      continue;
    }
    lines.push("### Totales generados");
    lines.push(renderTotals(op.result.totales));
    lines.push("");
    if (op.result.warnings?.length) {
      lines.push("### Warnings del motor");
      for (const w of op.result.warnings) lines.push(`- ${w}`);
      lines.push("");
    }
    lines.push("### BOM generado");
    lines.push(renderBomTable(op.result.allItems));
    lines.push("");
    lines.push("### Comparación contra golden");
    lines.push(renderComparison(cmp));
    lines.push("");
  }

  if (caseData.assumptions?.length) {
    lines.push("## Assumptions tomadas");
    for (const a of caseData.assumptions) lines.push(`- ${a}`);
    lines.push("");
  }
  if (caseData.gaps_pendientes?.length) {
    lines.push("## Gaps pendientes");
    for (const g of caseData.gaps_pendientes) lines.push(`- ${g}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function buildRunReport(caseReports) {
  const lines = [];
  lines.push(`# Run report — ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`Casos: ${caseReports.length}`);
  let matches = 0, diffs = 0, nogolds = 0, errors = 0;
  for (const r of caseReports) {
    for (const op of r.runResult.opciones_resultados) {
      if (op.result.error) errors += 1;
    }
    for (const cmp of r.comparison?.perOpcion || []) {
      if (cmp.status === "match") matches += 1;
      else if (cmp.status === "diff") diffs += 1;
      else if (cmp.status === "no_golden") nogolds += 1;
    }
  }
  lines.push(`- Match: ${matches}`);
  lines.push(`- Diff: ${diffs}`);
  lines.push(`- Sin golden: ${nogolds}`);
  lines.push(`- Errores motor: ${errors}`);
  lines.push("");
  lines.push("## Detalle");
  for (const r of caseReports) {
    lines.push(`- [${r.caseData.case_id}](./${r.caseData.case_id}.report.md) — ${r.caseData.inputs_raw?.cliente || "—"}`);
  }
  return lines.join("\n");
}

export function writeReports({ runDir, caseData, runResult, comparison, caseReportMd }) {
  fs.mkdirSync(runDir, { recursive: true });
  const reportPath = path.join(runDir, `${caseData.case_id}.report.md`);
  fs.writeFileSync(reportPath, caseReportMd, "utf8");
  const dumpPath = path.join(runDir, `${caseData.case_id}.generated.json`);
  fs.writeFileSync(dumpPath, JSON.stringify({ runResult, comparison }, null, 2), "utf8");
  return { reportPath, dumpPath };
}
