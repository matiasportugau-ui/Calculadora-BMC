/**
 * Map a lista-web quote BOM onto Shopify cart lines (handle + hints).
 * Variant ids are resolved in the widget against live /products/{handle}.json.
 */

export const PANEL_HANDLES = Object.freeze({
  ISODEC_EPS: "isopanel-isodec-eps-cubiertas-bmc-reloaded",
  ISODEC_PIR: "isodec®-pir",
  ISOROOF_3G: "isoroof-3g-gris-rojo-blanco-bromyros",
  ISOROOF: "isoroof-3g-gris-rojo-blanco-bromyros",
  ISOROOF_FOIL: "iagro30",
  ISOROOF_PLUS: "iroof80-pls",
  ISOPANEL_EPS: "isopanel-eps-paredes-y-fachadas",
  ISOWALL_PIR: "isowall-®-pir",
});

export const SKU_HANDLES = Object.freeze({
  varilla_38: "varilla-roscada-bsw-3_8",
  tuerca_38: "tuerca-bsw-3-8-galvanizada",
  arandela_carrocero: "arandela-carrocero-3-8-galvanizada",
  arandela_plana: "arandela-plana-galv-3-8",
  arandela_pp: "arandela-polipropileno-tortuga",
  cinta_butilo: "cinta-butilo",
  silicona: "bromplast-8-silicona-neutra",
  silicona_300_neutra: "silicona-neutra-pomo-premium",
});

const DESC_HANDLES = [
  [/gotero frontal.*isodec|gotero frontal para isodec/i, "gotero-frontal-isodec"],
  [/gotero lateral de c[aá]mara.*isodec/i, "gotero-lateral-de-camara-isodec"],
  [/gotero (lateral|superior).*isodec/i, "gotero-lateral-para-isodec-copia"],
  [/cumbrera.*isodec/i, "cumbrera-isodec"],
  [/babeta.*adosar/i, "babeta-isodec-adosar"],
  [/babeta.*empotrar/i, "babeta-de-empotrar-isodec"],
  [/canal[oó]n.*isodec/i, "canalon-isodec-kit-completo"],
  [/soporte.*canal[oó]n.*isodec/i, "soporte-de-canalon-isodec"],
  [/gotero frontal.*isoroof/i, "gotero-frontal-simple-isoroof"],
  [/gotero lateral de c[aá]mara.*isoroof/i, "gotero-lateral-de-camara-isoroof"],
  [/gotero lateral.*isoroof/i, "gotero-lateral-isoroof"],
  [/cumbrera.*isoroof/i, "cumbrera-isoroof-3g"],
  [/cinta butilo/i, "cinta-butilo"],
  [/tornillo t1/i, "tornillo-t1-p-mecha-01"],
];

function familyFromSku(sku) {
  const s = String(sku || "").toUpperCase();
  const hit = Object.keys(PANEL_HANDLES).sort((a, b) => b.length - a.length).find((k) => s.startsWith(k));
  return hit || "";
}

function mmFromSkuOrLabel(sku, label) {
  const blob = `${sku || ""} ${label || ""}`;
  const m = blob.match(/(\d{2,3})\s*mm/i) || String(sku || "").match(/-(\d{2,3})\b/);
  return m ? m[1] : "";
}

function colorFromQuote(input = {}) {
  const raw = String(input.techo?.color || input.pared?.color || input.camara?.color || "Blanco");
  const c = raw.trim();
  if (/gris/i.test(c)) return "Gris";
  if (/rojo|terracota/i.test(c)) return /terracota/i.test(c) ? "Terracota" : "Rojo";
  return "Blanco";
}

function handleForItem(item) {
  const sku = String(item.sku || "");
  if (/^FLETE$/i.test(sku)) return "";
  if (SKU_HANDLES[sku]) return SKU_HANDLES[sku];
  const fam = familyFromSku(sku);
  if (fam) return PANEL_HANDLES[fam];
  const label = String(item.descripcion || item.label || "");
  for (const [re, handle] of DESC_HANDLES) {
    if (re.test(label)) return handle;
  }
  return "";
}

function quantityForItem(item) {
  const cant = Number(item.cant) || 0;
  const unidad = String(item.unidad || "").toLowerCase();
  if (unidad.includes("m²") || unidad.includes("m2")) return Math.max(1, Math.round(cant));
  if (unidad === "m" || unidad === "ml") return Math.max(1, Math.ceil(cant / 3));
  return Math.max(1, Math.ceil(cant));
}

/**
 * @param {object} bom  gptResp.bom groups
 * @param {object} [quoteInput]  techo/pared/camara from the tool payload
 * @returns {object[]}
 */
export function bomToCartLines(bom, quoteInput = {}) {
  const groups = Array.isArray(bom) ? bom : [];
  const color = colorFromQuote(quoteInput);
  const espesorHint = String(
    quoteInput.techo?.espesor || quoteInput.pared?.espesor || quoteInput.camara?.espesor || "",
  ).replace(/\D/g, "");
  const out = [];
  const seen = new Set();
  for (const g of groups) {
    for (const item of g.items || []) {
      const handle = handleForItem(item);
      if (!handle) continue;
      const sku = String(item.sku || "");
      const descripcion = String(item.descripcion || item.label || sku);
      const espesor = mmFromSkuOrLabel(sku, descripcion) || espesorHint;
      const quantity = Math.min(500, quantityForItem(item));
      const key = `${handle}|${espesor}|${color}|${sku}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        handle,
        sku: sku || null,
        title: descripcion.slice(0, 80),
        espesor,
        color,
        quantity,
        cant: Number(item.cant) || quantity,
        unidad: item.unidad || "",
        pu_usd: Number(item.pu_usd || item.pu) || 0,
      });
    }
  }
  return out;
}

export function quotePayloadToCotizarBody(payload = {}) {
  return {
    lista: "web",
    escenario: payload.scenario || payload.escenario,
    flete: 0,
    source: "storefront-voice",
    ...(payload.techo ? { techo: payload.techo } : {}),
    ...(payload.pared ? { pared: payload.pared } : {}),
    ...(payload.camara ? { camara: payload.camara } : {}),
  };
}
