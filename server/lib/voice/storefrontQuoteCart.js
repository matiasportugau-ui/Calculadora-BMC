/**
 * Map a lista-web quote BOM onto Shopify cart lines (handle + hints).
 * Variant ids are resolved in the widget against live /products/{handle}.json.
 *
 * Real `/calc` BOM lines use labels like "Frente Inf: Canalón" / "Soporte canalón"
 * (no "IsoDec"/"IsoRoof" token) and matriz SKUs (CD50, 6801, GFS50, …). Mapping must
 * not require brand tokens in the description.
 */

import { PERFIL_TECHO } from "../../../src/data/constants.js";
import {
  panelFamGroup,
  resolveBorderMedia,
} from "../../../src/data/product-media/productMediaResolve.js";

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
  tornillo_t1: "tornillo-t1-p-mecha-01",
});

/** Borders without product-media-links entries (or special shop products). */
const EXTRA_BORDER_HANDLES = Object.freeze({
  soporte_canalon: Object.freeze({
    ISODEC: "soporte-de-canalon-isodec",
    ISODEC_PIR: "soporte-de-canalon-isodec",
    ISOROOF: "soporte-para-canalon-isoroof",
    ISOROOF_COLONIAL: "soporte-para-canalon-isoroof",
  }),
  gotero_superior: Object.freeze({
    // No IsoDec-only superior SKU in shop; lateral IsoDec listing is the sellable stand-in.
    ISODEC: "gotero-lateral-para-isodec-copia",
    ISODEC_PIR: "gotero-lateral-para-isodec-copia",
    ISOROOF: "gotero-superior-3g-isoroof",
    ISOROOF_COLONIAL: "gotero-superior-3g-isoroof",
  }),
});

/** Synthetic / voice-agent labels that already include brand tokens. */
const DESC_HANDLES = [
  [/gotero frontal.*isodec|gotero frontal para isodec/i, "gotero-frontal-isodec"],
  [/gotero lateral de c[aá]mara.*isodec/i, "gotero-lateral-de-camara-isodec"],
  [/gotero (lateral|superior).*isodec/i, "gotero-lateral-para-isodec-copia"],
  [/cumbrera.*isodec/i, "cumbrera-isodec"],
  [/babeta.*adosar.*isodec|babeta.*isodec.*adosar/i, "babeta-isodec-adosar"],
  [/babeta.*empotrar.*isodec|babeta.*isodec.*empotrar/i, "babeta-de-empotrar-isodec"],
  // Soporte must beat the generic canalón kit regex (substring "canalón … isodec").
  [/soporte.*canal[oó]n.*isodec/i, "soporte-de-canalon-isodec"],
  [/canal[oó]n.*isodec/i, "canalon-isodec-kit-completo"],
  [/gotero frontal.*isoroof/i, "gotero-frontal-simple-isoroof"],
  [/gotero lateral de c[aá]mara.*isoroof/i, "gotero-lateral-de-camara-isoroof"],
  [/gotero lateral.*isoroof/i, "gotero-lateral-isoroof"],
  [/cumbrera.*isoroof/i, "cumbrera-isoroof-3g"],
  [/soporte.*canal[oó]n.*isoroof/i, "soporte-para-canalon-isoroof"],
  [/canal[oó]n.*isoroof/i, "canalon-doble-isoroof-bandeja-tapas-agujero-bajada"],
  [/babeta.*adosar.*isoroof|babeta.*isoroof.*adosar|babeta.*atornillar.*isoroof/i, "babeta-de-atornillar-lateral-isoroof"],
  [/babeta.*empotrar.*isoroof|babeta.*isoroof.*empotrar/i, "babeta-de-empotrar-lateral-isoroof"],
  [/cinta butilo/i, "cinta-butilo"],
  [/tornillo t1/i, "tornillo-t1-p-mecha-01"],
];

function handleForBorder(borderId, familia) {
  const fam = panelFamGroup(familia) || String(familia || "");
  const extra = EXTRA_BORDER_HANDLES[borderId];
  if (extra) {
    return extra[fam] || extra.ISODEC || extra.ISOROOF || "";
  }
  if (!borderId || borderId === "embudo" || borderId === "vaina") return "";
  return resolveBorderMedia({ borderId, familia: fam }).handle || "";
}

function eachPerfilSku(byEsp, visit) {
  if (!byEsp || typeof byEsp !== "object") return;
  if (byEsp._all && byEsp._all.sku) {
    visit(byEsp._all.sku);
    return;
  }
  for (const entry of Object.values(byEsp)) {
    if (entry?.sku) visit(entry.sku);
    else if (entry?._all?.sku) visit(entry._all.sku);
  }
}

/** Matriz SKU → Shopify handle from PERFIL_TECHO + product-media border links. */
function buildPerfilSkuHandles() {
  const map = Object.create(null);
  for (const [borderId, byFam] of Object.entries(PERFIL_TECHO)) {
    if (!byFam || typeof byFam !== "object") continue;
    if (borderId === "embudo" || borderId === "vaina") continue;
    for (const [fam, byEsp] of Object.entries(byFam)) {
      if (fam === "_all") continue;
      const handle = handleForBorder(borderId, fam);
      if (!handle) continue;
      eachPerfilSku(byEsp, (sku) => {
        map[sku] = handle;
      });
    }
  }
  return Object.freeze(map);
}

const PERFIL_SKU_HANDLES = buildPerfilSkuHandles();

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

/**
 * Infer border id from calc BOM labels ("Frente Inf: Canalón", "Lat.Izq: Gotero Lateral", …).
 * Soporte must be checked before canalón (substring).
 */
export function borderIdFromCalcLabel(label) {
  const t = String(label || "").toLowerCase();
  if (!t) return "";
  if (/soporte.*canal[oó]n|soporte canal[oó]n/.test(t)) return "soporte_canalon";
  if (/canal[oó]n/.test(t)) return "canalon";
  if (/gotero.*c[aá]mara|camara/.test(t) && /gotero/.test(t)) return "gotero_lateral_camara";
  if (/gotero.*greca|greca/.test(t)) return "gotero_frontal_greca";
  if (/gotero.*superior/.test(t)) return "gotero_superior";
  if (/gotero.*(frontal|simple)/.test(t)) return "gotero_frontal";
  if (/gotero.*lateral/.test(t)) return "gotero_lateral";
  if (/babeta.*empotr/.test(t)) return "babeta_empotrar";
  if (/babeta/.test(t)) return "babeta_adosar";
  if (/cumbrera/.test(t)) return "cumbrera";
  return "";
}

function familiaFromLabelOrQuote(label, input = {}) {
  const t = String(label || "");
  if (/isoroof.?colonial|colonial/i.test(t) && /isoroof|cumbrera|gotero|babeta|canal/i.test(t)) {
    return "ISOROOF_COLONIAL";
  }
  if (/isoroof|3g\b/i.test(t)) return "ISOROOF";
  if (/isodec.?pir/i.test(t)) return "ISODEC_PIR";
  if (/isodec/i.test(t)) return "ISODEC";
  const q = String(input.techo?.familia || input.pared?.familia || input.camara?.familia || "");
  return q;
}

function handleForItem(item, quoteInput = {}) {
  const sku = String(item.sku || "");
  if (/^FLETE$/i.test(sku)) return "";
  if (SKU_HANDLES[sku]) return SKU_HANDLES[sku];
  if (PERFIL_SKU_HANDLES[sku]) return PERFIL_SKU_HANDLES[sku];
  const fam = familyFromSku(sku);
  if (fam) return PANEL_HANDLES[fam];
  const label = String(item.descripcion || item.label || "");
  for (const [re, handle] of DESC_HANDLES) {
    if (re.test(label)) return handle;
  }
  const borderId = borderIdFromCalcLabel(label);
  if (borderId) {
    const borderFam = familiaFromLabelOrQuote(label, quoteInput);
    const handle = handleForBorder(borderId, borderFam);
    if (handle) return handle;
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
  const indexByKey = new Map();
  for (const g of groups) {
    for (const item of g.items || []) {
      const handle = handleForItem(item, quoteInput);
      if (!handle) continue;
      const sku = String(item.sku || "");
      const descripcion = String(item.descripcion || item.label || sku);
      const espesor = mmFromSkuOrLabel(sku, descripcion) || espesorHint;
      const quantity = Math.min(500, quantityForItem(item));
      const key = `${handle}|${espesor}|${color}|${sku}`;
      const prevIdx = indexByKey.get(key);
      if (prevIdx != null) {
        const prev = out[prevIdx];
        prev.quantity = Math.min(500, prev.quantity + quantity);
        prev.cant = (Number(prev.cant) || 0) + (Number(item.cant) || quantity);
        continue;
      }
      indexByKey.set(key, out.length);
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
