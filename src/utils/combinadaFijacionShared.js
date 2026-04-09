/** Material de fijación en modo estructura "Combinada" (varilla/tuerca). */
export const COMBINADA_MATERIAL_ORDER = ["hormigon", "metal", "madera"];

export function cycleCombinadaMaterial(current) {
  const c = current === "hormigon" || current === "metal" || current === "madera" ? current : "metal";
  const i = COMBINADA_MATERIAL_ORDER.indexOf(c);
  return COMBINADA_MATERIAL_ORDER[(i + 1) % COMBINADA_MATERIAL_ORDER.length];
}

/**
 * Asigna materiales en orden fila-major según conteos globales (alinear con steppers).
 */
export function buildInitialByKeyFromOrderedDots(dotKeysInOrder, ptsHorm, ptsMetal, ptsMadera) {
  const out = {};
  let i = 0;
  const nH = Math.max(0, Math.floor(Number(ptsHorm) || 0));
  const nM = Math.max(0, Math.floor(Number(ptsMetal) || 0));
  const nMad = Math.max(0, Math.floor(Number(ptsMadera) || 0));
  const take = (mat, n) => {
    for (let k = 0; k < n && i < dotKeysInOrder.length; k++, i++) {
      out[dotKeysInOrder[i]] = mat;
    }
  };
  take("hormigon", nH);
  take("metal", nM);
  take("madera", nMad);
  while (i < dotKeysInOrder.length) {
    out[dotKeysInOrder[i++]] = "metal";
  }
  return out;
}

export function countCombinadaMaterialsInDots(dots, byKey) {
  let h = 0;
  let metal = 0;
  let madera = 0;
  for (const d of dots) {
    const k = d.key;
    const mat = byKey[k] === "hormigon" || byKey[k] === "metal" || byKey[k] === "madera" ? byKey[k] : "metal";
    if (mat === "hormigon") h += 1;
    else if (mat === "madera") madera += 1;
    else metal += 1;
  }
  return { ptsHorm: h, ptsMetal: metal, ptsMadera: madera };
}

export function mergeCombinadaByKeyWithDefaults(dotKeysInOrder, existingByKey, ptsHorm, ptsMetal, ptsMadera) {
  const ex = existingByKey && typeof existingByKey === "object" ? { ...existingByKey } : {};
  const missing = dotKeysInOrder.filter((k) => ex[k] == null);
  if (missing.length === 0) return ex;
  if (Object.keys(ex).length === 0) {
    return buildInitialByKeyFromOrderedDots(dotKeysInOrder, ptsHorm, ptsMetal, ptsMadera);
  }
  const init = buildInitialByKeyFromOrderedDots(dotKeysInOrder, ptsHorm, ptsMetal, ptsMadera);
  return { ...init, ...ex };
}
