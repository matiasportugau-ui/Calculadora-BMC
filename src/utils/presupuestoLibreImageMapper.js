// ═══════════════════════════════════════════════════════════════════════════
// src/utils/presupuestoLibreImageMapper.js
// Maps products from constants.js to images from quoteVisorShopifyFamilies.json
// ═══════════════════════════════════════════════════════════════════════════

import SHOPIFY_FAMILIES from '../data/quoteVisorShopifyFamilies.json';

/**
 * Get first image for a product family
 * @param {string} familyKey - Family identifier (ej: "ISODEC_EPS", "ISOROOF_3G")
 * @returns {string|null} Image URL or null if not found
 */
export function getProductImage(familyKey) {
  if (!SHOPIFY_FAMILIES?.byFamily?.[familyKey]) {
    return null;
  }

  const family = SHOPIFY_FAMILIES.byFamily[familyKey];

  // Try to get first image from gallery
  if (family.gallery && family.gallery.length > 0) {
    return family.gallery[0].src;
  }

  return null;
}

/**
 * Get image for a product by family and color
 * @param {string} familyKey - Family identifier
 * @param {string} color - Color name (ej: "Blanco", "Gris")
 * @returns {string|null} Image URL or null if not found
 */
export function getProductImageByColor(familyKey, color) {
  if (!SHOPIFY_FAMILIES?.byFamily?.[familyKey]) {
    return getProductImage(familyKey);
  }

  const family = SHOPIFY_FAMILIES.byFamily[familyKey];

  // Try color-specific images first
  if (family.byColor?.[color] && family.byColor[color].length > 0) {
    return family.byColor[color][0].src;
  }

  // Fallback to first gallery image
  return getProductImage(familyKey);
}

/**
 * Get product URL for a family
 * @param {string} familyKey - Family identifier
 * @returns {string|null} Product URL or null
 */
export function getProductUrl(familyKey) {
  if (!SHOPIFY_FAMILIES?.byFamily?.[familyKey]) {
    return null;
  }

  const family = SHOPIFY_FAMILIES.byFamily[familyKey];

  if (family.gallery && family.gallery.length > 0) {
    return family.gallery[0].href;
  }

  return null;
}

/**
 * Check if family has images available
 * @param {string} familyKey - Family identifier
 * @returns {boolean}
 */
export function hasFamilyImages(familyKey) {
  return !!SHOPIFY_FAMILIES?.byFamily?.[familyKey]?.gallery?.length;
}

/**
 * Get all available families with images
 * @returns {string[]} Array of family keys
 */
export function getAvailableFamilies() {
  return Object.keys(SHOPIFY_FAMILIES?.byFamily || {});
}
