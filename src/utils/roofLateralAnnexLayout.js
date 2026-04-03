// ═══════════════════════════════════════════════════════════════════════════
// roofLateralAnnexLayout.js — Anexos laterales (mismo cuerpo): solo costados
// izq/der en planta, cadena por lateralRank. Ver ROOF-LATERAL-ANNEX-SAME-BODY-SPEC.md
//
// Sin importar roofPlanGeometry (evita ciclo: geometry → este módulo → geometry).
// Mantener ROOF_LATERAL_LAYOUT_GAP_M alineado con ROOF_PLAN_GAP_M en roofPlanGeometry.js
// ═══════════════════════════════════════════════════════════════════════════

/** Mismo valor que ROOF_PLAN_GAP_M (m). */
export const ROOF_LATERAL_LAYOUT_GAP_M = 0.25;

function effW(z, is2A) {
  return is2A ? z.ancho / 2 : z.ancho;
}

/**
 * @param {object} z
 * @returns {boolean}
 */
export function isLateralAnnexZona(z) {
  const ap = z?.preview?.attachParentGi;
  return Number.isFinite(Number(ap)) && Number(ap) >= 0;
}

function parseGroupKey(key) {
  const i = key.lastIndexOf("|");
  const parentGi = Number(key.slice(0, i));
  const side = key.slice(i + 1);
  return { parentGi, side: side === "izq" ? "izq" : "der" };
}

/**
 * @param {number} parentGi
 * @param {"izq"|"der"} side
 * @param {number[]} gis
 * @param {object[]} zonas
 * @param {Record<number, {x:number,y:number,w:number,h:number}>} rects
 * @param {number} gapM
 * @param {boolean} is2A
 */
function placeLateralChain(parentGi, side, gis, zonas, rects, gapM, is2A) {
  const parent = rects[parentGi];
  if (!parent) return;
  const items = gis
    .map((gi) => {
      const z = zonas[gi];
      const w = effW(z, is2A);
      const h = z.largo;
      return { gi, w, h, rk: Number(z.preview?.lateralRank) || 0 };
    })
    .sort((a, b) => a.rk - b.rk || a.gi - b.gi);

  if (side === "der") {
    let curX = parent.x + parent.w + gapM;
    const y = parent.y;
    for (const it of items) {
      rects[it.gi] = { x: curX, y, w: it.w, h: it.h };
      curX += it.w + gapM;
    }
  } else {
    let curX = parent.x - gapM;
    const y = parent.y;
    for (const it of items) {
      curX -= it.w;
      rects[it.gi] = { x: curX, y, w: it.w, h: it.h };
      curX -= gapM;
    }
  }
}

/**
 * Calcula posiciones en planta: raíces en fila (preview manual o auto); anexos solo laterales.
 * @param {Array<{ largo: number, ancho: number, preview?: object }>} zonas
 * @param {"una_agua"|"dos_aguas"} [tipoAguas]
 * @param {number} [gapM]
 * @returns {Array<object>} zonas clonadas con preview.x / preview.y unificados
 */
export function applyLateralAnnexLayout(zonas = [], tipoAguas = "una_agua", gapM = ROOF_LATERAL_LAYOUT_GAP_M) {
  const is2A = tipoAguas === "dos_aguas";
  const n = zonas.length;
  /** @type {Record<number, { x: number, y: number, w: number, h: number }>} */
  const rects = {};

  const roots = [];
  for (let gi = 0; gi < n; gi++) {
    const z = zonas[gi];
    if (!z || !(z.largo > 0 && z.ancho > 0)) continue;
    if (isLateralAnnexZona(z)) continue;
    roots.push(gi);
  }

  let ax = 0;
  const auto = {};
  for (const gi of roots) {
    const z = zonas[gi];
    const w = effW(z, is2A);
    const h = z.largo;
    auto[gi] = { x: ax, y: 0, w, h };
    ax += w + gapM;
  }
  for (const gi of roots) {
    const z = zonas[gi];
    const w = effW(z, is2A);
    const h = z.largo;
    const p = z.preview;
    const a = auto[gi];
    const pos = p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : { x: a.x, y: a.y };
    rects[gi] = { x: pos.x, y: pos.y, w, h };
  }

  const annexGis = [];
  for (let gi = 0; gi < n; gi++) {
    const z = zonas[gi];
    if (!z || !(z.largo > 0 && z.ancho > 0)) continue;
    if (!isLateralAnnexZona(z)) continue;
    annexGis.push(gi);
  }

  const groups = new Map();
  for (const gi of annexGis) {
    const z = zonas[gi];
    const parentGi = Number(z.preview.attachParentGi);
    const side = z.preview.lateralSide === "izq" ? "izq" : "der";
    const key = `${parentGi}|${side}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(gi);
  }

  let guard = 0;
  const maxIt = Math.max(annexGis.length * 4, 8);
  while (guard++ < maxIt) {
    let progressed = false;
    for (const [key, gis] of groups) {
      const { parentGi, side } = parseGroupKey(key);
      if (!rects[parentGi]) continue;
      if (gis.every((gi) => rects[gi])) continue;
      if (gis.some((gi) => rects[gi])) continue;
      placeLateralChain(parentGi, side, gis, zonas, rects, gapM, is2A);
      progressed = true;
    }
    if (!progressed) break;
  }

  let orphanAx = ax;
  for (let gi = 0; gi < n; gi++) {
    const z = zonas[gi];
    if (!z || !(z.largo > 0 && z.ancho > 0)) continue;
    if (rects[gi]) continue;
    const w = effW(z, is2A);
    const h = z.largo;
    rects[gi] = { x: orphanAx, y: 0, w, h };
    orphanAx += w + gapM;
  }

  return zonas.map((z, gi) => {
    const r = rects[gi];
    if (!r || !z) return z;
    return { ...z, preview: { ...(z.preview || {}), x: r.x, y: r.y } };
  });
}

/**
 * Rectángulos en planta a partir de zonas ya fusionadas por `applyLateralAnnexLayout`.
 * @param {object[]} mergedZonas
 * @param {"una_agua"|"dos_aguas"} [tipoAguas]
 */
export function plantRectsFromMergedZonas(mergedZonas = [], tipoAguas = "una_agua") {
  const is2A = tipoAguas === "dos_aguas";
  return mergedZonas
    .map((z, gi) => ({ z, gi }))
    .filter(({ z }) => z?.largo > 0 && z?.ancho > 0)
    .map(({ z, gi }) => ({
      gi,
      z,
      x: Number(z.preview?.x) || 0,
      y: Number(z.preview?.y) || 0,
      w: effW(z, is2A),
      h: z.largo,
    }));
}

/**
 * Auto gap: 0 si solo raíces sin preview; gap estándar si hay anexo lateral o preview manual.
 * @returns {ReturnType<typeof plantRectsFromMergedZonas>}
 */
export function zonasToPlantRectsWithAutoGap(zonas = [], tipoAguas = "una_agua") {
  const anyAnnex = zonas.some(isLateralAnnexZona);
  const anyManual = zonas.some((z) => Number.isFinite(z?.preview?.x) && Number.isFinite(z?.preview?.y));
  const valid = zonas.filter((z) => z?.largo > 0 && z?.ancho > 0);
  const rootCount = valid.filter((z) => !isLateralAnnexZona(z)).length;
  /** Varias raíces en fila: mismo criterio que layoutZonasEnPlanta (gap visual). Una sola raíz sin anexo ni drag: gap 0. */
  const gapM = anyAnnex || anyManual || rootCount > 1 ? ROOF_LATERAL_LAYOUT_GAP_M : 0;
  const merged = applyLateralAnnexLayout(zonas, tipoAguas, gapM);
  return plantRectsFromMergedZonas(merged, tipoAguas);
}

/**
 * Layout lógico gap 0 (encuentros / BOM compartidos).
 * @returns {ReturnType<typeof plantRectsFromMergedZonas>}
 */
export function zonasToPlantRectsLogical(zonas = [], tipoAguas = "una_agua") {
  const merged = applyLateralAnnexLayout(zonas, tipoAguas, 0);
  return plantRectsFromMergedZonas(merged, tipoAguas);
}
