// ═══════════════════════════════════════════════════════════════════════════
// src/utils/calc/index.js — Re-exports from modular calculation files
//
// New code should import from specific modules (e.g. ./skuResolver.js).
// This index provides backward compatibility for existing imports.
// ═══════════════════════════════════════════════════════════════════════════

export { resolveSKU, resolveSKU_techo, resolvePerfilPared } from "./skuResolver.js";
export { distributePointsByStructure } from "./structureDispatch.js";
