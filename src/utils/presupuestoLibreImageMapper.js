// ═══════════════════════════════════════════════════════════════════════════
// src/utils/presupuestoLibreImageMapper.js
// Maps products from constants.js to images.
// Lookup precedence:
//   1. presupuestoLibreImages.json (deterministic per-key map — panels,
//      composite perfil keys like "gotero_frontal:ISOROOF", item keys like
//      "silicona"). Regenerate with `npm run images:presupuesto-libre`.
//   2. quoteVisorShopifyFamilies.json (legacy techo-family galleries).
//   3. null (card renders its text placeholder).
// ═══════════════════════════════════════════════════════════════════════════

import SHOPIFY_FAMILIES from '../data/quoteVisorShopifyFamilies.json';
import PL_IMAGES from '../data/presupuestoLibreImages.json';

/**
 * Get first image for a product key
 * @param {string} familyKey - Catalog key (ej: "ISODEC_EPS", "gotero_frontal:ISOROOF", "silicona")
 * @returns {string|null} Image URL or null if not found
 */
export function getProductImage(familyKey) {
  const mapped = PL_IMAGES?.byKey?.[familyKey];
  if (mapped?.src) {
    return mapped.src;
  }

  const family = SHOPIFY_FAMILIES?.byFamily?.[familyKey];

  // Try to get first image from gallery
  if (family?.gallery && family.gallery.length > 0) {
    return family.gallery[0].src;
  }

  return null;
}

/**
 * Get image for a product by key and color
 * @param {string} familyKey - Catalog key
 * @param {string} color - Color name (ej: "Blanco", "Gris")
 * @returns {string|null} Image URL or null if not found
 */
export function getProductImageByColor(familyKey, color) {
  const mapped = PL_IMAGES?.byKey?.[familyKey];
  if (mapped?.byColor?.[color]) {
    return mapped.byColor[color];
  }
  if (mapped?.src) {
    return mapped.src;
  }

  const family = SHOPIFY_FAMILIES?.byFamily?.[familyKey];

  // Try color-specific images first
  if (family?.byColor?.[color] && family.byColor[color].length > 0) {
    return family.byColor[color][0].src;
  }

  // Fallback to first gallery image
  return getProductImage(familyKey);
}

/**
 * Get product URL for a key
 * @param {string} familyKey - Catalog key
 * @returns {string|null} Product URL or null
 */
export function getProductUrl(familyKey) {
  const mapped = PL_IMAGES?.byKey?.[familyKey];
  if (mapped?.href) {
    return mapped.href;
  }

  const family = SHOPIFY_FAMILIES?.byFamily?.[familyKey];

  if (family?.gallery && family.gallery.length > 0) {
    return family.gallery[0].href;
  }

  return null;
}

/**
 * Check if key has images available
 * @param {string} familyKey - Catalog key
 * @returns {boolean}
 */
export function hasFamilyImages(familyKey) {
  return !!PL_IMAGES?.byKey?.[familyKey]?.src
    || !!SHOPIFY_FAMILIES?.byFamily?.[familyKey]?.gallery?.length;
}

/**
 * Get all available keys with images
 * @returns {string[]} Array of catalog keys
 */
export function getAvailableFamilies() {
  return [...new Set([
    ...Object.keys(PL_IMAGES?.byKey || {}),
    ...Object.keys(SHOPIFY_FAMILIES?.byFamily || {}),
  ])];
}
