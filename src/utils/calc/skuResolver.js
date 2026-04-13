// ═══════════════════════════════════════════════════════════════════════════
// src/utils/calc/skuResolver.js — Unified SKU resolution for profiles
//
// Consolidates resolveSKU_techo() and resolvePerfilPared() into a single
// pattern. Both follow the same lookup: type → family → thickness → _all.
// ═══════════════════════════════════════════════════════════════════════════

import { getPricing } from "../../data/pricing.js";

/**
 * Resolve a profile SKU from the pricing catalog.
 *
 * Lookup order: source[tipo][familia][espesor] → source[tipo][familia]._all → source[tipo]._all
 *
 * @param {"PERFIL_TECHO"|"PERFIL_PARED"} source — which catalog section to search
 * @param {string} tipo — profile type (e.g. "gotero_frontal", "perfil_u", "esquinero_ext")
 * @param {string|null} familia — panel family (e.g. "ISOROOF", "ISOPANEL_EPS"). Null for family-agnostic profiles.
 * @param {number|string|null} espesor — thickness in mm. Null if profile is thickness-agnostic.
 * @param {Object} [options] — special case overrides
 * @param {Object} [options.familyAliases] — e.g. { "ISOROOF_COLONIAL": "ISOROOF" } for shared profiles
 * @returns {Object|null} — resolved profile data with { label, sku, largo, venta, web, costo, ... } or null
 */
export function resolveSKU(source, tipo, familia, espesor, options = {}) {
  const pricing = getPricing();
  const catalog = pricing[source];
  if (!catalog) return null;

  const byTipo = catalog[tipo];
  if (!byTipo) return null;

  // Apply family alias (e.g. ISOROOF_COLONIAL → ISOROOF for non-cumbrera profiles)
  let fam = familia;
  if (fam && options.familyAliases?.[fam]) {
    fam = options.familyAliases[fam];
  }

  if (fam) {
    const byFam = byTipo[fam];
    if (byFam) {
      if (espesor != null && byFam[espesor]) return { ...byFam[espesor] };
      if (byFam._all) return { ...byFam._all };
    }
  }

  // Fallback to family-agnostic _all entry
  if (byTipo._all) return { ...byTipo._all };
  return null;
}

/** ISOROOF_COLONIAL alias: uses ISOROOF 3G profiles except for cumbrera. */
const TECHO_ALIASES = { ISOROOF_COLONIAL: "ISOROOF" };

/**
 * Resolve a roof profile SKU. Drop-in replacement for the old resolveSKU_techo().
 *
 * @param {string} tipo — profile type (e.g. "gotero_frontal", "cumbrera")
 * @param {string} familiaP — panel family (e.g. "ISOROOF_3G", "ISODEC_EPS")
 * @param {number|string} espesor — thickness in mm
 * @returns {Object|null}
 */
export function resolveSKU_techo(tipo, familiaP, espesor) {
  // ISOROOF_COLONIAL uses ISOROOF profiles EXCEPT for cumbrera
  const aliases = tipo === "cumbrera" ? {} : TECHO_ALIASES;
  return resolveSKU("PERFIL_TECHO", tipo, familiaP, espesor, { familyAliases: aliases });
}

/**
 * Resolve a wall profile SKU. Drop-in replacement for the old resolvePerfilPared().
 *
 * @param {string} tipo — profile type (e.g. "perfil_u", "esquinero_ext")
 * @param {string|null} familia — panel family
 * @param {number|string|null} espesor — thickness in mm
 * @returns {Object|null}
 */
export function resolvePerfilPared(tipo, familia, espesor) {
  return resolveSKU("PERFIL_PARED", tipo, familia, espesor);
}
