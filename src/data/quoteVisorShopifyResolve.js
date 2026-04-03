import baseMap from "./quoteVisorShopifyMap.json";
import { BORDER_OPTIONS } from "./constants.js";

const OVERRIDE_STORAGE_KEY = "bmc-visor-shopify-overrides";

/** @returns {Record<string, string>} borderOptionId → image URL */
export function readShopifyImageOverrides() {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDE_STORAGE_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw);
    return typeof j === "object" && j !== null ? j : {};
  } catch {
    return {};
  }
}

export function writeShopifyImageOverride(borderId, url) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const cur = readShopifyImageOverrides();
    if (!url || !String(url).trim()) delete cur[borderId];
    else cur[borderId] = String(url).trim();
    window.localStorage.setItem(OVERRIDE_STORAGE_KEY, JSON.stringify(cur));
  } catch {
    /* quota */
  }
}

/** @param {string} borderId */
export function resolveBorderShopifyEntry(borderId) {
  const fromBase = baseMap?.byBorderId?.[borderId];
  const ov = readShopifyImageOverrides();
  const src = ov[borderId] || fromBase?.imageSrc || "";
  return {
    imageSrc: src,
    productUrl: fromBase?.productUrl || "https://bmcuruguay.com.uy/collections/all",
    shopifyHandle: fromBase?.shopifyHandle ?? null,
  };
}

/**
 * @param {object} p
 * @param {Record<string, string>} [p.borders]
 * @param {Record<string, string>[]} [p.zonasBorders]
 * @param {string} [p.tipoAguas]
 * @returns {{ id: string; src: string; title: string; subtitle?: string; href: string }[]}
 */
export function getBorderAccentSlides({ borders = {}, zonasBorders = [], tipoAguas = "una_agua" }) {
  const ids = new Set();
  const sides = ["frente", "fondo", "latIzq", "latDer"];
  const disabled = tipoAguas === "dos_aguas" ? new Set(["fondo"]) : new Set();
  sides.forEach((side) => {
    if (disabled.has(side)) return;
    const v = borders?.[side];
    if (v && v !== "none") ids.add(v);
  });
  (zonasBorders || []).forEach((zb) => {
    sides.forEach((side) => {
      if (disabled.has(side)) return;
      const v = zb?.[side];
      if (v && v !== "none") ids.add(v);
    });
  });

  const labelFor = (bid) => {
    for (const side of sides) {
      const opts = BORDER_OPTIONS[side] || [];
      const hit = opts.find((o) => o.id === bid);
      if (hit) return hit.label;
    }
    return bid.replace(/_/g, " ");
  };

  return [...ids].map((id) => {
    const r = resolveBorderShopifyEntry(id);
    return {
      id,
      src: r.imageSrc,
      title: labelFor(id),
      subtitle: "Referencia tienda / perfil",
      href: r.productUrl,
    };
  });
}
