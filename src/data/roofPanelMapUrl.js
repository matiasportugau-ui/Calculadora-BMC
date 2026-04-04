/**
 * Resuelve URL de textura para el render 3D referencial del techo (Vista 3D).
 * Usa galerías Shopify en quoteVisorShopifyFamilies.json; fallback a roofPanelVisualProfiles.
 */

import shopifyFamilies from "./quoteVisorShopifyFamilies.json" with { type: "json" };
import { ROOF_CATALOG_MAP_URL_BY_FAMILIA } from "./roofPanelCatalogMapUrls.js";

/** @param {string} url @param {string} [familiaKey] */
function scoreTextureUrl(url, familiaKey) {
  if (!url || typeof url !== "string") return -1e9;
  const path = url.split("?")[0].toLowerCase();
  const fam = typeof familiaKey === "string" ? familiaKey.trim() : "";
  let s = 0;
  if (path.endsWith("/file.jpg") || path.endsWith("file.jpg")) s -= 80;
  if (path.includes("ficha") || path.includes(".pdf.")) s -= 55;
  if (path.includes("flyer") || path.includes("_flyer_")) s -= 12;
  if (path.endsWith(".avif")) s -= 10;
  if (/\.(png|jpg|jpeg|webp)$/i.test(path)) s += 28;
  if (path.includes("isodec") || path.includes("isoroof")) s += 12;
  if (fam === "ISOROOF_PLUS" && path.includes("isoroof_plus")) s += 40;
  if (fam === "ISOROOF_PLUS" && path.includes("isoroof.jpg")) s -= 25;
  if (fam === "ISOROOF_3G" && path.includes("isoroof_plus")) s -= 50;
  if (fam === "ISOROOF_FOIL" && (path.includes("foil") || path.includes("isoagro"))) s += 30;
  if (fam === "ISOROOF_FOIL" && path.includes("isoroof.jpg") && !path.includes("foil")) s -= 20;
  return s;
}

/**
 * @param {Array<{ src?: string }>|undefined|null} slides
 * @param {string} [familiaKey] alinea el asset con la línea (p. ej. ISOROOF_PLUS vs 3G)
 * @returns {string}
 */
export function pickBestMapUrlFromSlides(slides, familiaKey) {
  const urls = (slides || [])
    .map((x) => x?.src)
    .filter((u) => typeof u === "string" && /^https?:\/\//i.test(u));
  if (!urls.length) return "";
  let best = urls[0];
  let bestScore = scoreTextureUrl(best, familiaKey);
  for (let i = 1; i < urls.length; i++) {
    const sc = scoreTextureUrl(urls[i], familiaKey);
    if (sc > bestScore) {
      bestScore = sc;
      best = urls[i];
    }
  }
  return best;
}

/**
 * @param {string} [color]
 * @returns {string} Clave en byColor ("Blanco" | "Gris" | "Rojo") o "" si no matchea
 */
export function normalizeRoofColorKey(color) {
  const c = String(color || "").trim();
  if (!c) return "";
  const lower = c.toLowerCase();
  const aliases = {
    blanco: "Blanco",
    gris: "Gris",
    rojo: "Rojo",
    white: "Blanco",
    gray: "Gris",
    grey: "Gris",
    red: "Rojo",
  };
  if (aliases[lower]) return aliases[lower];
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
}

/**
 * @param {string} [familiaKey]
 * @param {string} [techoColor] Blanco / Gris / Rojo (u otros según byColor en JSON)
 * @returns {string} Siempre una URL (fallback perfil visual)
 */
export function getRoofPanelMapUrl(familiaKey, techoColor) {
  const key = typeof familiaKey === "string" ? familiaKey.trim() : "";
  const byFamily = shopifyFamilies?.byFamily;
  const fam = key && byFamily && typeof byFamily === "object" ? byFamily[key] : null;

  if (fam && typeof fam === "object") {
    const nk = normalizeRoofColorKey(techoColor);
    let slides = null;
    if (nk && fam.byColor && typeof fam.byColor === "object" && Array.isArray(fam.byColor[nk])) {
      slides = fam.byColor[nk];
    }
    if (!slides?.length && Array.isArray(fam.gallery)) slides = fam.gallery;
    const picked = pickBestMapUrlFromSlides(slides, key);
    if (picked) return picked;
  }

  return ROOF_CATALOG_MAP_URL_BY_FAMILIA[key] || ROOF_CATALOG_MAP_URL_BY_FAMILIA.ISODEC_EPS;
}
