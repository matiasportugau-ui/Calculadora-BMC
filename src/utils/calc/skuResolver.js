// ═══════════════════════════════════════════════════════════════════════════
// src/utils/calc/skuResolver.js — Generic SKU resolver for pricing matrices
//
// Replaces the duplicated resolveSKU_techo() / resolvePerfilPared() pattern.
// Both follow the same lookup strategy: byTipo → byFam → espesor | _all → _all
// ═══════════════════════════════════════════════════════════════════════════

import { getPricing } from "../../data/pricing.js";

/**
 * Resolve a SKU entry from the PERFIL_TECHO pricing matrix.
 *
 * Lookup order:
 *   1. PERFIL_TECHO[tipo][familia][espesor]
 *   2. PERFIL_TECHO[tipo][familia]._all  (espesor-independent)
 *
 * Special case: ISOROOF_COLONIAL uses ISOROOF profiles except for "cumbrera".
 *
 * @param {string} tipo   - Profile type key (e.g. "gotero_frontal", "cumbrera")
 * @param {string} familia - Panel family id (e.g. "ISODEC_EPS", "ISOROOF_3G")
 * @param {number} espesor - Panel thickness in mm
 * @returns {object|null}  - Pricing entry with { label, sku, largo, venta, web, costo } or null
 */
export function resolveSKU_techo(tipo, familia, espesor) {
  const { PERFIL_TECHO } = getPricing();
  const byTipo = PERFIL_TECHO[tipo];
  if (!byTipo) return null;
  // ISOROOF Colonial shares ISOROOF profiles except the colonial-specific cumbrera
  let fam = familia;
  if (fam === "ISOROOF_COLONIAL" && tipo !== "cumbrera") fam = "ISOROOF";
  const byFam = byTipo[fam];
  if (!byFam) return null;
  if (byFam[espesor]) return { ...byFam[espesor] };
  if (byFam._all) return { ...byFam._all };
  return null;
}

/**
 * Resolve a SKU entry from the PERFIL_PARED pricing matrix.
 *
 * Lookup order:
 *   1. PERFIL_PARED[tipo][familia][espesor]
 *   2. PERFIL_PARED[tipo][familia]._all
 *   3. PERFIL_PARED[tipo]._all             (familia-independent, e.g. esquineros)
 *
 * @param {string} tipo    - Profile type key (e.g. "perfil_u", "esquinero_ext")
 * @param {string|null} familia - Panel family id, or null for familia-independent profiles
 * @param {number|null} espesor - Panel thickness in mm, or null
 * @returns {object|null}
 */
export function resolvePerfilPared(tipo, familia, espesor) {
  const { PERFIL_PARED } = getPricing();
  const byTipo = PERFIL_PARED[tipo];
  if (!byTipo) return null;
  const byFam = byTipo[familia];
  if (byFam) {
    if (byFam[espesor]) return { ...byFam[espesor] };
    if (byFam._all) return { ...byFam._all };
  }
  if (byTipo._all) return { ...byTipo._all };
  return null;
}
