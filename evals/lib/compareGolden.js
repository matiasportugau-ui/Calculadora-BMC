export const TOLERANCES = {
  totalPct: 0.01,
  qtyExact: true,
};

function within(actual, expected, pct) {
  if (expected == null || actual == null) return false;
  if (expected === 0) return actual === 0;
  return Math.abs(actual - expected) / Math.abs(expected) <= pct;
}

function compareTotals(generated, golden) {
  const out = { checks: [], matches: 0, total: 0 };
  const sinIvaGen = generated?.totales?.subtotalSinIVA ?? null;
  const conIvaGen = generated?.totales?.totalFinal ?? null;
  const sinIvaGold = golden?.monto_total_sin_iva_usd ?? null;
  const conIvaGold = golden?.monto_total_con_iva_usd ?? null;

  if (sinIvaGold != null) {
    const ok = within(sinIvaGen, sinIvaGold, TOLERANCES.totalPct);
    out.checks.push({
      kind: "total_sin_iva",
      generated: sinIvaGen,
      golden: sinIvaGold,
      diff: sinIvaGen != null ? sinIvaGen - sinIvaGold : null,
      tolerance: `±${TOLERANCES.totalPct * 100}%`,
      ok,
    });
    out.total += 1;
    if (ok) out.matches += 1;
  }
  if (conIvaGold != null) {
    const ok = within(conIvaGen, conIvaGold, TOLERANCES.totalPct);
    out.checks.push({
      kind: "total_con_iva",
      generated: conIvaGen,
      golden: conIvaGold,
      diff: conIvaGen != null ? conIvaGen - conIvaGold : null,
      tolerance: `±${TOLERANCES.totalPct * 100}%`,
      ok,
    });
    out.total += 1;
    if (ok) out.matches += 1;
  }
  return out;
}

function normalizeBomItem(it) {
  return {
    desc: (it.label || it.desc || it.nombre || "").trim().toLowerCase(),
    qty: Number(it.cant ?? it.qty ?? it.cantidad ?? 0),
    unit: it.unidad || it.unit || "",
  };
}

function compareBom(generatedItems = [], goldenItems = []) {
  const gen = generatedItems.map(normalizeBomItem);
  const gold = goldenItems.map(normalizeBomItem);
  const out = { checks: [], matches: 0, total: gold.length };

  for (const g of gold) {
    const match = gen.find((x) => x.desc === g.desc || x.desc.includes(g.desc) || g.desc.includes(x.desc));
    if (!match) {
      out.checks.push({ kind: "bom_missing", desc: g.desc, golden_qty: g.qty, ok: false });
      continue;
    }
    const ok = TOLERANCES.qtyExact ? match.qty === g.qty : within(match.qty, g.qty, 0.01);
    out.checks.push({
      kind: "bom_qty",
      desc: g.desc,
      generated_qty: match.qty,
      golden_qty: g.qty,
      ok,
    });
    if (ok) out.matches += 1;
  }
  return out;
}

export function compareOpcion(opcionResult, golden) {
  if (!golden || golden.status === "pendiente_de_envio_por_usuario" || golden.monto_total_sin_iva_usd == null) {
    return {
      status: "no_golden",
      reason: "Golden output no disponible para este caso",
      totals: null,
      bom: null,
    };
  }
  const totals = compareTotals(opcionResult.result, golden);
  const bom = compareBom(opcionResult.result.allItems, golden.bom || []);
  return {
    status: totals.matches === totals.total && bom.matches === bom.total ? "match" : "diff",
    totals,
    bom,
  };
}

export function compareRun(runResult, caseData) {
  const opciones = runResult.opciones_resultados || [];
  if (opciones.length === 1) {
    return { perOpcion: [compareOpcion(opciones[0], caseData.expected_output)] };
  }
  return {
    perOpcion: opciones.map((op) =>
      compareOpcion(op, caseData.expected_output?.por_opcion?.[op.label] || caseData.expected_output),
    ),
  };
}
