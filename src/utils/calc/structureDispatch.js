// ═══════════════════════════════════════════════════════════════════════════
// src/utils/calc/structureDispatch.js — Distribute fixation points by structure type
//
// Consolidates the repeated if/else dispatch pattern for
// metal/hormigon/madera/combinada that was copy-pasted 3 times
// in calcFijacionesVarilla().
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Distribute a total number of fixation points across structure types.
 *
 * Structure types:
 * - "metal": all points are metal-mounted (self-drilling screws)
 * - "hormigon": all points are concrete-anchored (expansion plugs + rods)
 * - "madera": all points are wood-mounted (lag screws)
 * - "combinada": user specifies exact split (ptsHorm, ptsMetal, ptsMadera)
 * - other/default: split between hormigon (up to ptsHorm) and metal (remainder)
 *
 * @param {number} puntos — total fixation points
 * @param {string} tipoEst — structure type
 * @param {number} [ptsHorm=0] — hormigon points (only used for "combinada" and default)
 * @param {number} [ptsMetal=0] — metal points (only used for "combinada")
 * @param {number} [ptsMadera=0] — wood points (only used for "combinada")
 * @returns {{ pMetal: number, pH: number, pMadera: number }}
 */
export function distributePointsByStructure(puntos, tipoEst, ptsHorm = 0, ptsMetal = 0, ptsMadera = 0) {
  if (tipoEst === "metal") return { pMetal: puntos, pH: 0, pMadera: 0 };
  if (tipoEst === "hormigon") return { pMetal: 0, pH: puntos, pMadera: 0 };
  if (tipoEst === "madera") return { pMetal: 0, pH: 0, pMadera: puntos };
  if (tipoEst === "combinada") {
    return {
      pH: Math.max(0, Math.floor(ptsHorm)),
      pMetal: Math.max(0, Math.floor(ptsMetal)),
      pMadera: Math.max(0, Math.floor(ptsMadera)),
    };
  }
  // Default: split between hormigon and metal
  const pH = Math.min(ptsHorm || 0, puntos);
  return { pMetal: puntos - pH, pH, pMadera: 0 };
}
