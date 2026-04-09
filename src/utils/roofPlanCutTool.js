// ═══════════════════════════════════════════════════════════════════════════
// roofPlanCutTool.js — Geometría para la herramienta de corte de paneles 2D.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Intersecciones de la LÍNEA INFINITA (lx1,ly1)→(lx2,ly2) con los 4 lados del rectángulo.
 * Devuelve [] o 2 puntos de entrada/salida.
 */
export function lineRectIntersections(lx1, ly1, lx2, ly2, rx, ry, rw, rh) {
  const dx = lx2 - lx1;
  const dy = ly2 - ly1;
  const pts = [];

  function tryEdge(ax, ay, bx, by) {
    const ex = bx - ax;
    const ey = by - ay;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-10) return;
    const t = ((ax - lx1) * ey - (ay - ly1) * ex) / denom;
    const s = ((ax - lx1) * dy - (ay - ly1) * dx) / denom;
    if (s >= -1e-6 && s <= 1 + 1e-6) {
      pts.push({ x: lx1 + t * dx, y: ly1 + t * dy });
    }
  }

  tryEdge(rx, ry, rx + rw, ry);
  tryEdge(rx + rw, ry, rx + rw, ry + rh);
  tryEdge(rx + rw, ry + rh, rx, ry + rh);
  tryEdge(rx, ry + rh, rx, ry);

  const unique = pts.filter(
    (p, i) => !pts.slice(0, i).some(q => Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6),
  );
  return unique.length >= 2 ? unique.slice(0, 2) : [];
}

/**
 * Polígono SVG del área "sobrante" (porción inferior al corte dentro del rect).
 * Devuelve string de puntos para <polygon points="..."/> o null si no hay corte.
 */
export function buildOffcutPolygon(lx1, ly1, lx2, ly2, rx, ry, rw, rh) {
  const pts = lineRectIntersections(lx1, ly1, lx2, ly2, rx, ry, rw, rh);
  if (pts.length < 2) return null;

  const ldx = lx2 - lx1;
  const ldy = ly2 - ly1;
  const side = (px, py) => (px - lx1) * ldy - (py - ly1) * ldx;

  // El sobrante es la porción "inferior" (y mayor) → usar el centro del borde inferior como referencia
  const refX = rx + rw * 0.5;
  const refY = ry + rh;
  const offcutSign = Math.sign(side(refX, refY)) || 1;

  const corners = [
    { x: rx, y: ry },
    { x: rx + rw, y: ry },
    { x: rx + rw, y: ry + rh },
    { x: rx, y: ry + rh },
  ].filter(c => {
    const s = side(c.x, c.y);
    return Math.abs(s) >= 1e-6 && Math.sign(s) === offcutSign;
  });

  const allPts = [...pts, ...corners];
  const cx = allPts.reduce((s, p) => s + p.x, 0) / allPts.length;
  const cy = allPts.reduce((s, p) => s + p.y, 0) / allPts.length;
  allPts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));

  return allPts.map(p => `${+p.x.toFixed(4)},${+p.y.toFixed(4)}`).join(' ');
}

/** Snappea la línea al ángulo más cercano múltiplo de 45°. */
export function snapCutLine(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return { x2, y2 };
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return {
    x2: x1 + len * Math.cos(snapped),
    y2: y1 + len * Math.sin(snapped),
  };
}

/** Ángulo en grados (0–90) para mostrar en el badge del draft. */
export function computeCutAngleDeg(x1, y1, x2, y2) {
  const a = Math.atan2(Math.abs(y2 - y1), Math.abs(x2 - x1)) * 180 / Math.PI;
  return Math.round(a);
}

/**
 * Para modo técnico: calcula el largo resultante de cada strip cortado por la línea.
 * Devuelve array de { ...strip, cutLargo, sobrante, isLongestEdge }
 *   cutLargo = distancia desde el borde superior del panel hasta el punto de corte.
 *   sobrante = largoPanelCompleto - cutLargo
 *   isLongestEdge = true si el corte es diagonal (borde más largo > cutLargo mínimo)
 */
export function computeCutOnStrips(lx1, ly1, lx2, ly2, strips, zoneX, zoneY, zoneLargo) {
  if (!strips?.length) return [];
  const dx = lx2 - lx1;
  const dy = ly2 - ly1;
  const isVertical = Math.abs(dx) < 1e-9;

  return strips.map(strip => {
    const sx = zoneX + strip.x0;
    const ex = sx + strip.width;

    // Intersección de la línea con el borde izquierdo y derecho del strip
    const getYAtX = (px) => {
      if (isVertical) return ly1;
      const t = (px - lx1) / dx;
      return ly1 + t * dy;
    };

    const yLeft = getYAtX(sx) - zoneY;
    const yRight = getYAtX(ex) - zoneY;

    // Ambos extremos fuera del rango del panel → no cortado
    if ((yLeft <= 0 && yRight <= 0) || (yLeft >= zoneLargo && yRight >= zoneLargo)) return null;

    const cutLargo = Math.min(
      zoneLargo,
      Math.max(0, Math.max(yLeft, yRight)), // borde más largo (para pedir a fábrica)
    );
    const sobrante = +(zoneLargo - cutLargo).toFixed(4);

    return {
      ...strip,
      cutLargo: +cutLargo.toFixed(4),
      sobrante,
      isDiagonal: Math.abs(yLeft - yRight) > 1e-3,
      yLeft: +Math.max(0, yLeft).toFixed(4),
      yRight: +Math.max(0, yRight).toFixed(4),
    };
  }).filter(Boolean);
}
