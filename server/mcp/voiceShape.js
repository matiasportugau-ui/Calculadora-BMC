/**
 * Compact tool results for voice TTS / ElevenLabs context windows.
 */

const MAX_CHARS = Number(process.env.PANELI_MCP_MAX_RESULT_CHARS || 12000);
const HEAVY_TOOLS = new Set([
  "obtener_informe_completo",
  "obtener_catalogo",
  "obtener_pdf_html",
  "wolfboard_export",
  "sheets_read_range",
]);

function truncateString(s, max = MAX_CHARS) {
  if (typeof s !== "string") return s;
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…[truncated ${s.length - max} chars for voice]`;
}

function compactCotizacion(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;

  // calcular_cotizacion returns flat money fields (subtotalSinIVA / totalConIVA / …),
  // not { totals, summary }. Map both shapes so voice clients never see nulls when
  // the motor already computed numbers (2026-08-26 Panelin BMC transcript bug).
  const totals =
    parsed.totals ||
    parsed.totales ||
    (parsed.subtotalSinIVA != null || parsed.totalConIVA != null
      ? {
          subtotal_sin_iva: parsed.subtotalSinIVA ?? null,
          iva_22: parsed.iva22 ?? null,
          total_con_iva: parsed.totalConIVA ?? null,
          area_m2: parsed.area_m2 ?? null,
          cant_paneles: parsed.cant_paneles ?? null,
        }
      : null);

  const summary =
    parsed.summary ||
    parsed.resumen ||
    (parsed.subtotalSinIVA != null || parsed.totalConIVA != null
      ? {
          subtotal_usd: parsed.subtotalSinIVA ?? null,
          iva_usd: parsed.iva22 ?? null,
          total_usd: parsed.totalConIVA ?? null,
          area_m2: parsed.area_m2 ?? null,
          cant_paneles: parsed.cant_paneles ?? null,
        }
      : null);

  const out = {
    ok: parsed.ok !== false,
    scenario: parsed.scenario,
    lista: parsed.lista || parsed.listaPrecios,
    totals,
    summary,
    // Keep flat aliases too (some clients already read these)
    subtotalSinIVA: parsed.subtotalSinIVA ?? summary?.subtotal_usd ?? null,
    totalConIVA: parsed.totalConIVA ?? summary?.total_usd ?? null,
    iva22: parsed.iva22 ?? summary?.iva_usd ?? null,
    area_m2: parsed.area_m2 ?? summary?.area_m2 ?? null,
    cant_paneles: parsed.cant_paneles ?? summary?.cant_paneles ?? null,
    warnings: parsed.warnings || [],
    autoportancia: parsed.autoportancia || null,
    pdf_url: parsed.pdf_url || parsed.pdfUrl || null,
    code: parsed.code || parsed.quote_code || null,
  };
  if (Array.isArray(parsed.bom)) {
    out.bom_groups = parsed.bom.map((g) => ({
      title: g.title,
      item_count: Array.isArray(g.items) ? g.items.length : 0,
      sample: (g.items || []).slice(0, 3).map((i) => ({
        label: i.label || i.sku,
        cant: i.cant,
        total: i.total,
      })),
    }));
  } else if (Array.isArray(parsed.allItems)) {
    out.item_count = parsed.allItems.length;
    out.sample_items = parsed.allItems.slice(0, 5).map((i) => ({
      label: i.label || i.sku,
      cant: i.cant,
      total: i.total,
    }));
  }
  if (parsed.textoWhatsApp) out.textoWhatsApp = truncateString(parsed.textoWhatsApp, 800);
  if (parsed.textoResumen) out.textoResumen = truncateString(parsed.textoResumen, 800);
  if (parsed.error) out.error = parsed.error;
  return out;
}

function compactCatalogo(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  const techo = parsed.techo || parsed.paneles_techo || parsed.PANELS_TECHO;
  const pared = parsed.pared || parsed.paneles_pared || parsed.PANELS_PARED;
  const summarizeFamilies = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    return Object.keys(obj).slice(0, 40).map((id) => {
      const row = obj[id];
      const espesores = row?.espesores
        ? Object.keys(row.espesores)
        : row?.precios
          ? Object.keys(row.precios)
          : [];
      return { id, label: row?.label || row?.nombre || id, espesores: espesores.slice(0, 12) };
    });
  };
  return {
    ok: true,
    lista: parsed.lista,
    techo_familias: summarizeFamilies(techo),
    pared_familias: summarizeFamilies(pared),
    note: "Catálogo compactado para voz. Pedí obtener_precio_panel para un espesor concreto.",
  };
}

function compactInforme(parsed) {
  if (!parsed || typeof parsed !== "object") return parsed;
  return {
    ok: true,
    lista: parsed.lista,
    data_version: parsed.data_version || parsed.version,
    escenarios: parsed.escenarios || parsed.scenarios || undefined,
    asesoría_keys: parsed.asesoria ? Object.keys(parsed.asesoria).slice(0, 20) : undefined,
    formulas_keys: parsed.formulas ? Object.keys(parsed.formulas).slice(0, 20) : undefined,
    note: "Informe compactado. Usá obtener_escenarios / obtener_catalogo / calcular_cotizacion.",
  };
}

/**
 * @param {string} toolName
 * @param {unknown} raw — JSON string or object from executeTool
 * @returns {string} JSON text for MCP content
 */
export function shapeToolResult(toolName, raw) {
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return truncateString(raw);
    }
  }

  let shaped = parsed;
  if (
    toolName === "calcular_cotizacion" ||
    toolName === "presupuesto_libre" ||
    toolName === "generar_pdf" ||
    toolName === "comparar_listas" ||
    toolName === "comparar_escenarios"
  ) {
    shaped = compactCotizacion(parsed);
  } else if (toolName === "obtener_catalogo") {
    shaped = compactCatalogo(parsed);
  } else if (toolName === "obtener_informe_completo") {
    shaped = compactInforme(parsed);
  } else if (toolName === "obtener_pdf_html" && parsed?.html) {
    shaped = {
      ok: parsed.ok !== false,
      pdf_id: parsed.pdf_id,
      html_chars: String(parsed.html).length,
      note: "HTML omitido en voz. Usá pdf_url / generar_pdf.",
    };
  } else if (HEAVY_TOOLS.has(toolName)) {
    shaped = parsed;
  }

  return truncateString(JSON.stringify(shaped, null, 0));
}
