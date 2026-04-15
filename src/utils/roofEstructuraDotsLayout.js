/**
 * Layout de puntos de fijación en planta (SVG m) para overlay Estructura.
 * Alineado a `computeRoofEstructuraHintsByGi` / `calcFijacionesVarilla`.
 */

/**
 * Posición Y de una fila de fijación en planta: filas perimetrales se desplazan hacia adentro (~30 cm).
 */
export function yForFijacionRowPlanta(r, rows, ri) {
  if (rows <= 1) return r.y + r.h / 2;
  const base = r.y + (ri / (rows - 1)) * r.h;
  const isPerimeter = ri === 0 || ri === rows - 1;
  if (!isPerimeter) return base;
  const insetNominalM = 0.3;
  const yInset = Math.min(insetNominalM, Math.max(0.04, r.h * 0.5 - 0.02));
  return ri === 0 ? base + yInset : base - yInset;
}

function yInteriorSplitsAlongVerticalEdge(y1, y2, espM) {
  const yMin = Math.min(y1, y2);
  const yMax = Math.max(y1, y2);
  const L = yMax - yMin;
  if (!(L > 0) || !(espM > 0)) return [];
  const nSeg = Math.ceil(L / espM);
  if (nSeg <= 1) return [];
  const out = [];
  for (let i = 1; i < nSeg; i++) out.push(yMin + (i * L) / nSeg);
  return out;
}

export function fijacionDotsPerimetroVerticalExterior(r, exterior, gi, espM) {
  const dots = [];
  let seq = 0;
  const inset = Math.min(0.3, Math.max(0.04, r.w * 0.11));
  const xLeft = r.x + Math.min(inset, Math.max(0.04, r.w * 0.06));
  const xRight = r.x + r.w - Math.min(inset, Math.max(0.04, r.w * 0.06));
  for (const e of exterior || []) {
    if (e.zoneIndex !== gi) continue;
    if (e.side !== "left" && e.side !== "right") continue;
    const xs = e.side === "left" ? xLeft : xRight;
    for (const cy of yInteriorSplitsAlongVerticalEdge(e.y1, e.y2, espM)) {
      dots.push({
        cx: xs,
        cy,
        key: `pv-${e.side}-${gi}-${seq++}`,
        rowIndex: -1,
        kind: "pv",
        edge: e.side,
      });
    }
  }
  return dots;
}

export function xPairFijacionPerimeterInPanel(xL, xR, insetNominalM = 0.3) {
  const w = xR - xL;
  if (!(w > 1e-9)) {
    const x = (xL + xR) / 2;
    return { xa: x, xb: x };
  }
  const minBetween = Math.max(0.045, w * 0.07);
  const minFromJoint = Math.min(insetNominalM, Math.max(0.04, w * 0.11));
  const third = w / 3;
  if (third >= minFromJoint && third >= minBetween) {
    return { xa: xL + third, xb: xL + 2 * third };
  }
  const innerL = xL + minFromJoint;
  const innerR = xR - minFromJoint;
  const innerW = innerR - innerL;
  if (innerW >= minBetween) {
    const mid = (innerL + innerR) / 2;
    const half = Math.min(innerW * 0.42, Math.max(minBetween / 2, innerW / 3));
    let xa = mid - half;
    let xb = mid + half;
    if (xb - xa < minBetween) {
      const pad = (minBetween - (xb - xa)) / 2;
      xa -= pad;
      xb += pad;
      xa = Math.max(innerL, Math.min(xa, xb - minBetween));
      xb = Math.min(innerR, Math.max(xb, xa + minBetween));
    }
    return { xa, xb };
  }
  const mid = (xL + xR) / 2;
  const eps = Math.max(0.02, w * 0.08);
  return { xa: mid - eps, xb: mid + eps };
}

/** Número de filas (ejes de apoyo) usado para repartir puntos. */
export function fijacionRowsFromHints(hints) {
  const nAp = Number(hints?.apoyos);
  return Number.isFinite(nAp) && nAp >= 2 ? Math.min(24, Math.max(2, Math.round(nAp))) : 2;
}

export function fijacionDotsLayoutDistributeTotal(r, hints) {
  const P = Math.round(Number(hints.puntosFijacion));
  if (!(P > 0) || !(r.w > 0) || !(r.h > 0)) return [];
  const rows = fijacionRowsFromHints(hints);
  const counts = [];
  const base = Math.floor(P / rows);
  let extra = P - base * rows;
  for (let i = 0; i < rows; i++) {
    counts.push(base + (extra > 0 ? 1 : 0));
    if (extra > 0) extra -= 1;
  }
  const mx = Math.min(r.w, Math.max(0.12, r.w * 0.06));
  const x0 = r.x + mx;
  const x1 = r.x + r.w - mx;
  const usableW = Math.max(1e-6, x1 - x0);
  const out = [];
  for (let ri = 0; ri < rows; ri++) {
    const nInRow = counts[ri] || 0;
    const yy = yForFijacionRowPlanta(r, rows, ri);
    for (let j = 0; j < nInRow; j++) {
      const t = nInRow === 1 ? 0.5 : (j + 1) / (nInRow + 1);
      const cx = x0 + t * usableW;
      out.push({
        cx,
        cy: yy,
        key: `r${ri}-j${j}`,
        rowIndex: ri,
        kind: "grid",
      });
    }
  }
  return out;
}

export function fijacionDotsLayoutIsodecGrid(r, hints, exterior) {
  const cantP = Math.max(1, Math.round(Number(hints.cantPaneles)) || 1);
  if (!(r.w > 0) || !(r.h > 0)) return [];
  const rows = fijacionRowsFromHints(hints);
  const panelW = r.w / cantP;
  const out = [];
  const insetNominal = 0.3;
  for (let ri = 0; ri < rows; ri++) {
    const yy = yForFijacionRowPlanta(r, rows, ri);
    const isPerimeter = ri === 0 || ri === rows - 1;
    for (let pi = 0; pi < cantP; pi++) {
      const xL = r.x + pi * panelW;
      const xR = r.x + (pi + 1) * panelW;
      if (isPerimeter) {
        const { xa, xb } = xPairFijacionPerimeterInPanel(xL, xR, insetNominal);
        out.push({ cx: xa, cy: yy, key: `r${ri}-p${pi}-a`, rowIndex: ri, kind: "grid" });
        out.push({ cx: xb, cy: yy, key: `r${ri}-p${pi}-b`, rowIndex: ri, kind: "grid" });
      } else {
        out.push({
          cx: (xL + xR) / 2,
          cy: yy,
          key: `r${ri}-p${pi}-c`,
          rowIndex: ri,
          kind: "grid",
        });
      }
    }
  }
  const espM = Number(hints?.fijacionEspaciadoPerimetroM) || 2.5;
  const extra =
    exterior?.length && hints?.fijacionDotsMode === "isodec_grid"
      ? fijacionDotsPerimetroVerticalExterior(r, exterior, r.gi, espM)
      : [];
  return [...out, ...extra];
}

export function fijacionDotsLayout(r, hints, exterior) {
  if (!hints || !(r.w > 0) || !(r.h > 0)) return [];
  const useGrid =
    hints.fijacionSistema === "varilla_tuerca" && hints.fijacionDotsMode === "isodec_grid";
  if (useGrid) return fijacionDotsLayoutIsodecGrid(r, hints, exterior);
  const P = Math.round(Number(hints.puntosFijacion));
  if (!(P > 0)) return [];
  return fijacionDotsLayoutDistributeTotal(r, hints);
}

/**
 * Claves de puntos de grilla cerca de la junta vertical interior entre paneles (índice 1..cantP-1).
 * Usa `^r{n}-p{pi}-` para no confundir `r1-p0-` con `p0` en otra posición, y filtra por `cx` si está disponible.
 * @param {Array<{key: string, kind?: string, cx?: number}>} dotPts
 * @param {number} jointIndex 1..cantP-1 (junta a la derecha del panel jointIndex-1)
 * @param {{ x: number, w: number }} r rectángulo zona en m
 * @param {number} cantP cantidad de paneles en ancho
 */
export function fijacionDotKeysForVerticalJoint(dotPts, jointIndex, r, cantP) {
  const j = Math.round(Number(jointIndex));
  const cp = Math.max(1, Math.round(Number(cantP)) || 1);
  if (!(j >= 1) || j >= cp || !r || !(r.w > 0)) return [];
  const a = j - 1;
  const b = j;
  const re = new RegExp(`^r\\d+-p(${a}|${b})-`);
  const panelW = r.w / cp;
  const xJoint = r.x + j * panelW;
  const tol = Math.max(0.09, panelW * 0.22);
  return (dotPts || [])
    .filter((d) => {
      if (d.kind !== "grid" || typeof d.key !== "string" || !re.test(d.key)) return false;
      if (typeof d.cx === "number" && Number.isFinite(d.cx)) {
        return Math.abs(d.cx - xJoint) <= tol;
      }
      return true;
    })
    .map((d) => d.key);
}

/**
 * Puntos de fijación cerca de la junta vertical entre paneles (índice 1..cantP-1).
 * En grilla ISODEC usa claves `r*-p*-`; en otros modos (p. ej. reparto total) filtra por `cx` vs la junta.
 * @param {Array<{ key: string, kind?: string, cx?: number }>} dotPts
 * @param {number} jointIndex
 * @param {{ x: number, w: number }} r
 * @param {number} cantP
 * @param {{ fijacionSistema?: string, fijacionDotsMode?: string } | null | undefined} hints
 */
export function fijacionDotKeysNearPanelJoint(dotPts, jointIndex, r, cantP, hints) {
  const useIsodec =
    hints?.fijacionSistema === "varilla_tuerca" && hints?.fijacionDotsMode === "isodec_grid";
  if (useIsodec) return fijacionDotKeysForVerticalJoint(dotPts, jointIndex, r, cantP);
  const j = Math.round(Number(jointIndex));
  const cp = Math.max(1, Math.round(Number(cantP)) || 1);
  if (!(j >= 1) || j >= cp || !r || !(r.w > 0)) return [];
  const panelW = r.w / cp;
  const xJoint = r.x + j * panelW;
  const tol = Math.max(0.09, panelW * 0.22);
  return (dotPts || [])
    .filter((d) => {
      if (d.kind === "pv") return false;
      if (typeof d.cx !== "number" || !Number.isFinite(d.cx)) return false;
      return Math.abs(d.cx - xJoint) <= tol;
    })
    .map((d) => d.key);
}
