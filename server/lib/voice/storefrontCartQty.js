/**
 * Quote→cart line quantity for Shopify.
 * Trust bomToCartLines quantity — do not rescale by lista pu vs shop price.
 * Shopify accessory list prices are often >> lista web unit prices; value-matching
 * under-orders hardware (e.g. 92 tuercas → 4).
 */

export function cartQtyFromLine(line, _shopPrice) {
  const q = Math.max(1, Math.round(Number(line?.quantity) || 1));
  return Math.min(500, q);
}
