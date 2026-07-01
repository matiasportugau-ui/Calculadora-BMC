// ═══════════════════════════════════════════════════════════════════════════
// polygonFloorPlan.js — Geometría de polígono rectilíneo para el editor de
// plano libre (Techo + Fachada). Convierte un contorno dibujado a mano en
// las mismas estructuras que ya consume el motor de cálculo:
//   - techo.zonas: [{ largo, ancho }, ...]  (rectángulos, sin cambios de contrato)
//   - pared.perimetro: número (el motor de pared ya es agnóstico de forma)
//
// Convención de ejes (coincide con FloorPlanEditor.jsx): extensión en Y = largo,
// extensión en X = ancho. Unidades: metros.
// ═══════════════════════════════════════════════════════════════════════════

const EPS = 1e-6;

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Redondea un punto {x,y} a un múltiplo de `gridSize` (metros). */
export function snapPointToGrid(point, gridSize) {
  const g = gridSize > 0 ? gridSize : 0.1;
  return {
    x: round2(Math.round(point.x / g) * g),
    y: round2(Math.round(point.y / g) * g),
  };
}

/**
 * Dado el punto anterior del polígono y un punto crudo (mouse/touch), fuerza
 * el nuevo segmento a ser horizontal o vertical (el eje con mayor desplazamiento
 * gana) y lo snapea a la grilla. Mantiene el polígono rectilíneo por construcción.
 */
export function snapToAxisAligned(prevPoint, rawPoint, gridSize) {
  const dx = rawPoint.x - prevPoint.x;
  const dy = rawPoint.y - prevPoint.y;
  const candidate = Math.abs(dx) >= Math.abs(dy)
    ? { x: rawPoint.x, y: prevPoint.y }
    : { x: prevPoint.x, y: rawPoint.y };
  return snapPointToGrid(candidate, gridSize);
}

/** Área con la fórmula del cordón (shoelace). Vertices: [{x,y}, ...], polígono cerrado implícito. */
export function polygonArea(vertices) {
  if (!Array.isArray(vertices) || vertices.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Perímetro: suma de longitudes de todos los lados (cierra el último con el primero). */
export function polygonPerimeter(vertices) {
  if (!Array.isArray(vertices) || vertices.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

/** true si todos los lados son horizontales o verticales (polígono ortogonal). */
export function isRectilinear(vertices, eps = EPS) {
  if (!Array.isArray(vertices) || vertices.length < 4) return false;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dx > eps && dy > eps) return false; // lado diagonal
    if (dx <= eps && dy <= eps) return false; // lado degenerado (mismo punto)
  }
  return true;
}

/**
 * Detecta autointersección entre lados no adyacentes (polígono simple).
 * O(n²), aceptable para contornos de planta (decenas de vértices, no miles).
 */
export function isSimplePolygon(vertices, eps = EPS) {
  if (!Array.isArray(vertices) || vertices.length < 4) return false;
  const n = vertices.length;
  const segIntersect = (p1, p2, p3, p4) => {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < eps) return false; // paralelos: no contamos colineales como cruce duro
    const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
    const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
    return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
  };
  for (let i = 0; i < n; i++) {
    const a1 = vertices[i];
    const a2 = vertices[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i) continue;
      const adjacent = j === i || (j + 1) % n === i || (i + 1) % n === j;
      if (adjacent) continue;
      const b1 = vertices[j];
      const b2 = vertices[(j + 1) % n];
      if (segIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

/**
 * Descompone un polígono rectilíneo simple en un set de rectángulos que cubren
 * exactamente su área, vía barrido horizontal + regla par-impar (even-odd) para
 * hallar los intervalos interiores en cada franja, seguido de un merge vertical
 * greedy para reducir fragmentación (franjas contiguas con el mismo intervalo X
 * se fusionan en un único rectángulo más alto).
 *
 * Devuelve rectángulos en coordenadas de planta: { x, y, width, height } — width
 * es la extensión en X (ancho), height la extensión en Y (largo).
 */
export function decomposeRectilinearPolygon(vertices, eps = EPS) {
  if (!isRectilinear(vertices, eps) || !isSimplePolygon(vertices, eps)) return [];

  const ys = [...new Set(vertices.map((v) => round2(v.y)))].sort((a, b) => a - b);
  if (ys.length < 2) return [];

  const n = vertices.length;
  const edges = [];
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    if (Math.abs(a.x - b.x) <= eps) {
      edges.push({ x: round2(a.x), yMin: Math.min(a.y, b.y), yMax: Math.max(a.y, b.y) });
    }
  }

  const stripRects = [];
  for (let s = 0; s < ys.length - 1; s++) {
    const y0 = ys[s];
    const y1 = ys[s + 1];
    if (y1 - y0 <= eps) continue;
    const midY = (y0 + y1) / 2;
    const crossXs = edges
      .filter((e) => midY > e.yMin + eps && midY < e.yMax - eps)
      .map((e) => e.x)
      .sort((a, b) => a - b);
    for (let k = 0; k + 1 < crossXs.length; k += 2) {
      const xa = crossXs[k];
      const xb = crossXs[k + 1];
      if (xb - xa <= eps) continue;
      stripRects.push({ x: xa, y: y0, width: round2(xb - xa), height: round2(y1 - y0) });
    }
  }

  // Merge vertical greedy: franjas contiguas con mismo x/width se fusionan.
  let merged = stripRects;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < merged.length; i++) {
      for (let j = 0; j < merged.length; j++) {
        if (i === j) continue;
        const a = merged[i];
        const b = merged[j];
        if (!a || !b) continue;
        const sameColumn = Math.abs(a.x - b.x) <= eps && Math.abs(a.width - b.width) <= eps;
        const stacked = Math.abs(a.y + a.height - b.y) <= eps;
        if (sameColumn && stacked) {
          merged[i] = { x: a.x, y: a.y, width: a.width, height: round2(a.height + b.height) };
          merged.splice(j, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return merged.map((r) => ({ x: round2(r.x), y: round2(r.y), width: round2(r.width), height: round2(r.height) }));
}

/**
 * Punto de entrada del editor: dado el contorno dibujado, produce exactamente
 * lo que PanelinCalculadoraV3 ya espera para techo.zonas / pared.perimetro
 * (mismo contrato que usa hoy FloorPlanEditor.jsx con un único rectángulo).
 */
export function polygonToFloorPlan(vertices) {
  const rects = decomposeRectilinearPolygon(vertices);
  const zonas = rects.map((r) => ({ largo: r.height, ancho: r.width }));
  return {
    zonas,
    perimetro: round2(polygonPerimeter(vertices)),
    area: round2(polygonArea(vertices)),
    rects,
    valid: rects.length > 0,
  };
}
