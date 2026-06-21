// ═══════════════════════════════════════════════════════════════════════════
// server/lib/cad/svgExport.js
// Modelo canónico de geometría (Y-up) → SVG profesional acotado (Y-down).
//
// Única fuente de verdad geométrica = planGeometry (metros, Y-up). Acá se
// INVIERTE Y (SVG es Y-down) en un solo lugar para evitar doble-flip.
// Estilo: contorno de muros, cotas rojas ISO, norte, escala gráfica, cajetín.
// ═══════════════════════════════════════════════════════════════════════════

const FONT = "Helvetica,Arial,sans-serif";

export function geometryToSvg(geom, opts = {}) {
  const S = opts.pxPerM || 52;                 // px por metro
  const padL = 2.4, padR = 1.0, padT = 1.0, padB = 4.6; // márgenes (m) p/cotas + cajetín
  const b = geom.bbox;
  const modelW = (b.maxX - b.minX) + padL + padR;
  const modelH = (b.maxY - b.minY) + padT + padB;

  const ox = padL - b.minX;                    // traslación modelo→lienzo (m)
  const oyTop = b.maxY + padT;                 // tope (para flip)
  const X = (x) => +(((x + ox) * S)).toFixed(2);
  const Y = (y) => +(((oyTop - y) * S)).toFixed(2); // FLIP Y aquí
  const sidePanel = 300;                       // panel derecho (px)
  const CW = Math.round(modelW * S + sidePanel);
  const CH = Math.round(modelH * S);

  const out = [];
  const add = (s) => out.push(s);

  // ── muros (doble línea) ─────────────────────────────────────────────────
  const path = (pts) => "M " + pts.map((p) => `${X(p[0])} ${Y(p[1])}`).join(" L ") + " Z";
  add(`<path d="${path(geom.footprint)}" fill="#fbfaf7" stroke="#1f2937" stroke-width="${0.2 * S}" stroke-linejoin="miter"/>`);
  if (Array.isArray(geom.innerWall)) {
    add(`<path d="${path(geom.innerWall)}" fill="#ffffff" stroke="#1f2937" stroke-width="1" stroke-linejoin="miter"/>`);
  }

  // ── cotas ───────────────────────────────────────────────────────────────
  for (const d of geom.dims) {
    const x1 = X(d.x1), y1 = Y(d.y1), x2 = X(d.x2), y2 = Y(d.y2);
    add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#b91c1c" stroke-width="1"/>`);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const px = (-dy / len) * 4, py = (dx / len) * 4;
    for (const [x, y] of [[x1, y1], [x2, y2]]) {
      add(`<line x1="${x - px}" y1="${y - py}" x2="${x + px}" y2="${y + py}" stroke="#b91c1c" stroke-width="1"/>`);
    }
    const tx = X(d.tx), ty = Y(d.ty);
    const rot = d.orient === "V" ? ` transform="rotate(-90 ${tx} ${ty})"` : "";
    const weight = d.kind === "overall" ? 700 : 600;
    add(`<text x="${tx}" y="${ty}" text-anchor="middle" font-family="${FONT}" font-size="${d.kind === "overall" ? 13 : 11}" font-weight="${weight}" fill="#b91c1c"${rot}>${d.label}</text>`);
  }

  // ── superficie (centro) ──────────────────────────────────────────────────
  const cx = X((b.minX + b.maxX) / 2), cy = Y((b.minY + b.maxY) / 2);
  add(`<text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="700" fill="#374151" letter-spacing="1">${esc(geom.title.titulo)}</text>`);
  add(`<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#6b7280">Superficie ${geom.areaM2} m²</text>`);

  // ── norte ────────────────────────────────────────────────────────────────
  const nx = modelW * S + 70, ny = 50;
  add(`<circle cx="${nx}" cy="${ny}" r="22" fill="none" stroke="#374151" stroke-width="1.2"/>`);
  add(`<path d="M ${nx} ${ny - 20} L ${nx - 7} ${ny + 6} L ${nx} ${ny} L ${nx + 7} ${ny + 6} Z" fill="#374151"/>`);
  add(`<text x="${nx}" y="${ny - 26}" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="700" fill="#374151">N</text>`);

  // ── escala gráfica ───────────────────────────────────────────────────────
  const sb = modelW * S + 40, sby = 150;
  add(`<text x="${sb}" y="${sby - 8}" font-family="${FONT}" font-size="10" fill="#6b7280">ESCALA GRÁFICA</text>`);
  for (let i = 0; i < 5; i++) add(`<rect x="${sb + i * S}" y="${sby}" width="${S}" height="6" fill="${i % 2 ? "#fff" : "#374151"}" stroke="#374151" stroke-width="0.8"/>`);
  for (let i = 0; i <= 5; i++) add(`<text x="${sb + i * S}" y="${sby + 18}" text-anchor="middle" font-family="${FONT}" font-size="9" fill="#6b7280">${i}</text>`);
  add(`<text x="${sb + 5 * S + 10}" y="${sby + 6}" font-family="${FONT}" font-size="9" fill="#6b7280">m</text>`);

  // ── cajetín ──────────────────────────────────────────────────────────────
  const tyB = CH - 64, tw = modelW * S;
  add(`<rect x="0" y="${tyB}" width="${tw}" height="64" fill="#1A3A5C"/>`);
  add(`<text x="18" y="${tyB + 26}" font-family="${FONT}" font-size="15" font-weight="700" fill="#fff">${esc(geom.title.titulo)}</text>`);
  add(`<text x="18" y="${tyB + 44}" font-family="${FONT}" font-size="11" fill="#cdd9e6">${esc(geom.title.subtitulo)}</text>`);
  add(`<text x="18" y="${tyB + 58}" font-family="${FONT}" font-size="9" fill="#9bb3cc">${esc(geom.title.pie)}</text>`);
  add(`<text x="${tw - 18}" y="${tyB + 34}" text-anchor="end" font-family="${FONT}" font-size="11" fill="#cdd9e6">${esc(geom.title.lamina)}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}" font-family="${FONT}">
<rect width="${CW}" height="${CH}" fill="#ffffff"/>
${out.join("\n")}
</svg>`;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
