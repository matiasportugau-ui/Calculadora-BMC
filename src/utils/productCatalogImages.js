// ═══════════════════════════════════════════════════════════════════════════
// productCatalogImages.js — Visual identity for Agregar Producto
// Every catalog row gets { src|null, group, shortCode, tone, fit } so list
// thumbs remain distinguishable even when no unique photo exists.
// ═══════════════════════════════════════════════════════════════════════════

import { ROOF_CATALOG_MAP_URL_BY_FAMILIA } from "../data/roofPanelCatalogMapUrls.js";

/** Panel product photos (Shopify store + local colonial). */
const PANEL_IMAGE_BY_FAMILIA = {
  ...ROOF_CATALOG_MAP_URL_BY_FAMILIA,
  ISOPANEL_EPS:
    "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/1e03a1_6071dc1dcd5743968a0bbe3e23fce220_mv2.png?v=1752607327",
  ISOWALL_PIR:
    "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/isowall_jpg.webp?v=1756840865",
  ISOFRIG_PIR:
    "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/isowall_jpg.webp?v=1756840865",
};

const FLASHING_IMAGE =
  "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/BabetadeAtornillarIsodec.jpg?v=1755206215";

const PROFILE_IMAGE =
  "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Anguloestructural-PerfilAluminioTipoK6_8m.jpg?v=1755192296";

const GOTERO_CAMARA_IMAGE =
  "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/Modelo3dG.LateralCamara-Gris-WEB01.png?v=1752240908";

const CANALON_IMAGE =
  "https://cdn.shopify.com/s/files/1/0946/4915/5898/files/3D-GoteroSuperiordeCamaraIsoroof3G-Gris-WEB01.png?v=1752254989";

/** Group → stage tone (hex). */
export const GROUP_TONES = {
  panel: "#0071e3",
  perfil_u: "#5b21b6",
  perfil_g2: "#6d28d9",
  canalon: "#7c3aed",
  gotero: "#8b5cf6",
  cumbrera: "#a78bfa",
  babeta: "#8430ce",
  soporte: "#6b21a8",
  perfil_other: "#7c3aed",
  tornillo: "#b45309",
  arandela: "#c2410c",
  anclaje: "#9a3412",
  taco: "#a16207",
  varilla: "#57534e",
  tuerca: "#78716c",
  remache: "#44403c",
  herramienta: "#0369a1",
  fijacion_other: "#b06000",
  silicona: "#15803d",
  espuma: "#16a34a",
  cinta: "#166534",
  membrana: "#14532d",
  sellador_other: "#188038",
  unknown: "#6e6e73",
};

/**
 * Compact code shown on stage when photos don't differentiate products.
 * @param {object} row
 * @returns {string}
 */
export function shortCodeFor(row) {
  if (!row) return "?";
  if (row.sku && String(row.sku).trim()) {
    const s = String(row.sku).trim();
    return s.length > 14 ? s.slice(0, 12) + "…" : s;
  }
  if (row.key) {
    const k = String(row.key).replace(/^fij:|^sell:|^pt:|^pp:/, "");
    return k.length > 14 ? k.slice(0, 12) + "…" : k;
  }
  const label = String(row.label || "").trim();
  if (!label) return "?";
  // First segment before · or (
  const head = label.split(/[·•|(]/)[0].trim();
  if (head.length <= 16) return head;
  return head.slice(0, 14) + "…";
}

/**
 * @param {object} row
 * @returns {string} visual group id
 */
export function visualGroupFor(row) {
  if (!row) return "unknown";

  if (row.kind === "panel" || row.category === "PANELES") return "panel";

  if (row.kind === "perfil" || row.category === "PERFILERÍA") {
    const t = `${row.label || ""} ${row.sku || ""}`.toLowerCase();
    if (/perfil\s*u\b|^u\s|perfil u/.test(t)) return "perfil_u";
    if (/perfil\s*g2|g2\b/.test(t)) return "perfil_g2";
    if (/canalon|canalón/.test(t)) return "canalon";
    if (/gotero/.test(t)) return "gotero";
    if (/cumbrera/.test(t)) return "cumbrera";
    if (/babeta|remate|cubrecanto|esquinero/.test(t)) return "babeta";
    if (/soporte/.test(t)) return "soporte";
    return "perfil_other";
  }

  if (row.kind === "fijacion" || row.category === "TORNILLERÍA") {
    // Prefer slug/key so labels like "Anclaje … (arandelas)" don't mis-group.
    const key = `${row.key || ""} ${row.id || ""}`.toLowerCase();
    const label = String(row.label || "").toLowerCase();
    const k = `${key} ${label}`;
    if (/pistola|herramienta|apl-dx|aplicadora/.test(k)) return "herramienta";
    if (/anclaje/.test(key) || /\banclaje\b/.test(label)) return "anclaje";
    if (/tornillo/.test(key) || /\btornillo/.test(label)) return "tornillo";
    if (/arandela|caballete|tortuga/.test(key) || /\barandela|\bcaballete|\btortuga/.test(label)) {
      return "arandela";
    }
    if (/taco/.test(k)) return "taco";
    if (/varilla/.test(key) || /\bvarilla\b/.test(label)) return "varilla";
    if (/tuerca/.test(key) || /\btuerca\b/.test(label)) return "tuerca";
    if (/remache/.test(k)) return "remache";
    return "fijacion_other";
  }

  if (row.kind === "sellador" || row.category === "SELLADORES") {
    const t = `${row.id || ""} ${row.key || ""} ${row.label || ""}`.toLowerCase();
    if (/silicona/.test(t)) return "silicona";
    if (/espuma|pu\b|poliuretano/.test(t)) return "espuma";
    if (/cinta|butilo/.test(t)) return "cinta";
    if (/membrana/.test(t)) return "membrana";
    return "sellador_other";
  }

  return "unknown";
}

/**
 * Resolve photo URL if it helps identity; otherwise null (use stage).
 * Perfiles only get photo for babeta (unique stock) or gotero/canalon CDN;
 * generic angle photo is NOT used for all perfiles (false differentiation).
 * @param {object} row
 * @param {string} group
 * @returns {string|null}
 */
function resolveSrc(row, group) {
  if (!row) return null;

  if (row.kind === "panel" && row.familia) {
    return PANEL_IMAGE_BY_FAMILIA[row.familia] || null;
  }

  if (row.kind === "perfil" || row.category === "PERFILERÍA") {
    if (group === "babeta") return FLASHING_IMAGE;
    if (group === "gotero") return GOTERO_CAMARA_IMAGE;
    if (group === "canalon") return CANALON_IMAGE;
    // U / G2 / cumbrera / soporte / other → stage only (shared stock photo misleads)
    if (group === "perfil_other") return PROFILE_IMAGE;
    return null;
  }

  return null;
}

/**
 * Full visual identity for a catalog row.
 * @param {object} row
 * @returns {{
 *   src: string|null,
 *   group: string,
 *   shortCode: string,
 *   tone: string,
 *   fit: 'contain'|'cover',
 *   placeholder: string,
 * }}
 */
export function resolveProductVisual(row) {
  const group = visualGroupFor(row);
  const src = resolveSrc(row, group);
  const tone = GROUP_TONES[group] || GROUP_TONES.unknown;
  return {
    src,
    group,
    shortCode: shortCodeFor(row),
    tone,
    fit: "contain",
    placeholder: group,
  };
}

/** @deprecated use resolveProductVisual */
export function resolveProductImage(row) {
  const v = resolveProductVisual(row);
  return {
    src: v.src,
    placeholder: row?.kind || "panel",
    tone: v.tone,
  };
}

/**
 * Split long catalog labels into primary (scan) + secondary (detail).
 * @param {object} row
 * @returns {{ primary: string, secondary: string }}
 */
export function splitProductLabel(row) {
  if (!row) return { primary: "", secondary: "" };
  const label = String(row.label || "").trim();
  const sku = row.sku ? String(row.sku) : "";

  if (row.kind === "panel") {
    const secondary = [
      sku || (row.familia ? String(row.familia) : ""),
      row.espesor != null ? `${row.espesor}mm` : "",
      row.colorDefault || "",
    ]
      .filter(Boolean)
      .join(" · ");
    return { primary: label, secondary };
  }

  // Perfiles often: "babeta empotrar · ISODEC_PIR · barra 3m · 6865"
  if (label.includes("·") || label.includes("•")) {
    const parts = label.split(/\s*[·•]\s*/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        primary: parts[0],
        secondary: parts.slice(1).join(" · ") + (sku && !label.includes(sku) ? ` · ${sku}` : ""),
      };
    }
  }

  // Long parenthetical: "Name (detail detail)"
  const paren = label.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (paren && paren[1].length >= 8) {
    return {
      primary: paren[1].trim(),
      secondary: [paren[2].trim(), sku].filter(Boolean).join(" · "),
    };
  }

  const secondary = [sku, row.category].filter(Boolean).join(" · ");
  return { primary: label, secondary };
}

export { PANEL_IMAGE_BY_FAMILIA };
