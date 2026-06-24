// ═══════════════════════════════════════════════════════════════════════════
// server/lib/cad/svgExport.js
// Modelo canónico de geometría (Y-up) → SVG profesional acotado (Y-down).
//
// Única fuente de verdad geométrica = planGeometry (metros, Y-up). Acá se
// INVIERTE Y en un solo lugar. Dibuja: muros (doble línea), ambientes,
// aberturas (puertas con barrido / ventanas), cotas ISO, norte, escala y
// cajetín ISO con campos.
// ═══════════════════════════════════════════════════════════════════════════

const FONT = "Helvetica,Arial,sans-serif";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function geometryToSvg(geom, opts = {}) {
  const S = opts.pxPerM || 52;
  const padL = 2.4, padR = 1.0, padT = 1.0, padB = 5.0;
  const b = geom.bbox;
  const modelW = (b.maxX - b.minX) + padL + padR;
  const modelH = (b.maxY - b.minY) + padT + padB;
  const ox = padL - b.minX;
  const oyTop = b.maxY + padT;
  const X = (x) => +(((x + ox) * S)).toFixed(2);
  const Y = (y) => +(((oyTop - y) * S)).toFixed(2); // FLIP Y
  const sidePanel = 300;
  const CW = Math.round(modelW * S + sidePanel);
  const CH = Math.round(modelH * S);

  const out = [];
  const add = (s) => out.push(s);
  const path = (pts) => "M " + pts.map((p) => `${X(p[0])} ${Y(p[1])}`).join(" L ") + " Z";

  // ── muros (doble línea) ─────────────────────────────────────────────────
  add(`<path d="${path(geom.footprint)}" fill="#fbfaf7" stroke="#1f2937" stroke-width="${0.2 * S}" stroke-linejoin="miter"/>`);
  if (Array.isArray(geom.innerWall)) add(`<path d="${path(geom.innerWall)}" fill="#ffffff" stroke="#1f2937" stroke-width="1" stroke-linejoin="miter"/>`);

  // ── ambientes ───────────────────────────────────────────────────────────
  for (const r of geom.rooms || []) {
    add(`<rect x="${X(r.x)}" y="${Y(r.y + r.h)}" width="${(r.w * S).toFixed(2)}" height="${(r.h * S).toFixed(2)}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 3"/>`);
    add(`<text x="${X(r.cx)}" y="${Y(r.cy)}" text-anchor="middle" font-family="${FONT}" font-size="12" font-weight="700" fill="#334155">${esc(r.name)}</text>`);
    add(`<text x="${X(r.cx)}" y="${Y(r.cy) + 14}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#64748b">${r.areaM2} m²</text>`);
  }

  // ── aberturas ───────────────────────────────────────────────────────────
  for (const o of geom.openings || []) {
    if (o.type === "window") {
      const px = -o.dir[1] * 0.04, py = o.dir[0] * 0.04;
      add(`<line x1="${X(o.x1 + px)}" y1="${Y(o.y1 + py)}" x2="${X(o.x2 + px)}" y2="${Y(o.y2 + py)}" stroke="#2563eb" stroke-width="2"/>`);
      add(`<line x1="${X(o.x1 - px)}" y1="${Y(o.y1 - py)}" x2="${X(o.x2 - px)}" y2="${Y(o.y2 - py)}" stroke="#2563eb" stroke-width="2"/>`);
    } else {
      const perp = [-o.dir[1] * o.swing, o.dir[0] * o.swing];
      const tip = [o.x1 + perp[0] * o.len, o.y1 + perp[1] * o.len];
      add(`<line x1="${X(o.x1)}" y1="${Y(o.y1)}" x2="${X(tip[0])}" y2="${Y(tip[1])}" stroke="#b45309" stroke-width="1.4"/>`);
      add(`<path d="M ${X(tip[0])} ${Y(tip[1])} A ${(o.len * S).toFixed(2)} ${(o.len * S).toFixed(2)} 0 0 ${o.swing === 1 ? 1 : 0} ${X(o.x2)} ${Y(o.y2)}" fill="none" stroke="#d97706" stroke-width="1"/>`);
    }
  }

  // ── cotas ───────────────────────────────────────────────────────────────
  for (const d of geom.dims) {
    const x1 = X(d.x1), y1 = Y(d.y1), x2 = X(d.x2), y2 = Y(d.y2);
    add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#b91c1c" stroke-width="1"/>`);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const px = (-dy / len) * 4, py = (dx / len) * 4;
    for (const [x, y] of [[x1, y1], [x2, y2]]) add(`<line x1="${x - px}" y1="${y - py}" x2="${x + px}" y2="${y + py}" stroke="#b91c1c" stroke-width="1"/>`);
    const tx = X(d.tx), ty = Y(d.ty);
    const rot = d.orient === "V" ? ` transform="rotate(-90 ${tx} ${ty})"` : "";
    add(`<text x="${tx}" y="${ty}" text-anchor="middle" font-family="${FONT}" font-size="${d.kind === "overall" ? 13 : 11}" font-weight="${d.kind === "overall" ? 700 : 600}" fill="#b91c1c"${rot}>${d.label}</text>`);
  }

  // ── superficie total (si no hay ambientes, al centro) ────────────────────
  if (!(geom.rooms || []).length) {
    const cx = X((b.minX + b.maxX) / 2), cy = Y((b.minY + b.maxY) / 2);
    add(`<text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="700" fill="#374151" letter-spacing="1">${esc(geom.title.titulo)}</text>`);
    add(`<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#6b7280">Superficie ${geom.areaM2} m²</text>`);
  }

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

  // ── cajetín ISO (campos) ─────────────────────────────────────────────────
  const T = geom.title;
  const bw = modelW * S, bh = 78, by = CH - bh;
  add(`<rect x="0" y="${by}" width="${bw}" height="${bh}" fill="#1A3A5C"/>`);
  const colX = bw * 0.62;
  add(`<line x1="${colX}" y1="${by}" x2="${colX}" y2="${CH}" stroke="#3c5a78"/>`);
  add(`<line x1="0" y1="${by + bh / 2}" x2="${bw}" y2="${by + bh / 2}" stroke="#3c5a78"/>`);
  const fld = (x, y, k, v, big) => {
    add(`<text x="${x + 12}" y="${y + 15}" font-family="${FONT}" font-size="8.5" fill="#9bb3cc" letter-spacing="1">${esc(k)}</text>`);
    add(`<text x="${x + 12}" y="${y + 31}" font-family="${FONT}" font-size="${big ? 14 : 11}" font-weight="${big ? 700 : 500}" fill="#fff">${esc(v || "—")}</text>`);
  };
  fld(0, by, "PROYECTO", T.proyecto, true);
  fld(0, by + bh / 2, "CLIENTE", T.cliente);
  fld(colX, by, "LÁMINA", T.lamina, true);
  fld(colX, by + bh / 2, "ESCALA / FECHA", `${T.escala}${T.fecha ? "  ·  " + T.fecha : ""}`);
  add(`<text x="${bw - 12}" y="${by + bh - 8}" text-anchor="end" font-family="${FONT}" font-size="9" fill="#9bb3cc">${esc(T.dibujo)}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}" font-family="${FONT}">
<rect width="${CW}" height="${CH}" fill="#ffffff"/>
${out.join("\n")}
</svg>`;
}
