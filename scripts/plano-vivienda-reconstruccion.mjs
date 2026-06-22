// Generador de plano de PERÍMETRO / CUBIERTA a partir del croquis.
// Interior vacío (sin subdivisiones). Cuerpo 14×6 + extensión en T 9×3.
import { writeFileSync } from "node:fs";

const S = 52;                 // px por metro
const OX = 150, OY = 150;     // origen del plano (px)
const m = (v) => v * S;
const X = (v) => OX + v * S;
const Y = (v) => OY + v * S;

const WEXT = 0.20 * S;        // muro exterior 20 cm
const INK = "#1f2937";

const out = [];
const add = (s) => out.push(s);

// ── geometría: cuerpo 14×6 + T 3×9 (brazo centrado: x 5,5 → 8,5; baja 9 m) ──
const T_W = 3, T_X0 = (14 - T_W) / 2, T_X1 = T_X0 + T_W;  // 5,5 .. 8,5
const T_D = 9;                                            // largo de la T (baja)
const contour = `M ${X(0)} ${Y(0)} H ${X(14)} V ${Y(6)} H ${X(T_X1)} V ${Y(6 + T_D)} H ${X(T_X0)} V ${Y(6)} H ${X(0)} Z`;

// ── helpers de cota (rojo, estilo ISO con ticks) ───────────────────────────
function dimH(x1, x2, yLevel, txt, off = 0) {
  const yy = Y(yLevel) + off;
  add(`<line x1="${X(x1)}" y1="${yy}" x2="${X(x2)}" y2="${yy}" stroke="#b91c1c" stroke-width="1"/>`);
  for (const x of [x1, x2]) add(`<line x1="${X(x)}" y1="${yy-4}" x2="${X(x)}" y2="${yy+4}" stroke="#b91c1c" stroke-width="1"/>`);
  add(`<text x="${(X(x1)+X(x2))/2}" y="${yy-5}" text-anchor="middle" font-family="Helvetica,Arial" font-size="13" font-weight="700" fill="#b91c1c">${txt}</text>`);
}
function dimV(y1, y2, xLevel, txt, off = 0) {
  const xx = X(xLevel) + off;
  add(`<line x1="${xx}" y1="${Y(y1)}" x2="${xx}" y2="${Y(y2)}" stroke="#b91c1c" stroke-width="1"/>`);
  for (const y of [y1, y2]) add(`<line x1="${xx-4}" y1="${Y(y)}" x2="${xx+4}" y2="${Y(y)}" stroke="#b91c1c" stroke-width="1"/>`);
  add(`<text x="${xx-6}" y="${(Y(y1)+Y(y2))/2}" text-anchor="middle" font-family="Helvetica,Arial" font-size="13" font-weight="700" fill="#b91c1c" transform="rotate(-90 ${xx-6} ${(Y(y1)+Y(y2))/2})">${txt}</text>`);
}

// ── relleno de cubierta (hatch suave) + contorno ────────────────────────────
add(`<path d="${contour}" fill="url(#hatch)"/>`);
add(`<path d="${contour}" fill="none" stroke="${INK}" stroke-width="${WEXT}" stroke-linejoin="miter"/>`);

// ── leyenda central del interior vacío ──────────────────────────────────────
const cx = (X(0) + X(14)) / 2, cy = Y(3);
add(`<text x="${cx}" y="${cy-8}" text-anchor="middle" font-family="Helvetica,Arial" font-size="20" font-weight="700" fill="#374151" letter-spacing="1">PERÍMETRO DE VIVIENDA</text>`);
add(`<text x="${cx}" y="${cy+16}" text-anchor="middle" font-family="Helvetica,Arial" font-size="13" fill="#6b7280">Interior sin subdividir · superficie de cubierta</text>`);
{ const ex = X((T_X0+T_X1)/2), ey = Y(6 + T_D/2);
  add(`<text x="${ex}" y="${ey}" text-anchor="middle" font-family="Helvetica,Arial" font-size="13" font-weight="700" fill="#6b7280" letter-spacing="3" transform="rotate(-90 ${ex} ${ey})">EXTENSIÓN EN T</text>`); }

// ── cotas ───────────────────────────────────────────────────────────────────
dimH(0, 14, 0, "14,00", -40);                 // ancho cuerpo principal
dimV(0, 6, 0, "6,00", -40);                   // profundidad cuerpo
dimH(0, T_X0, 6, "5,50", 46);                 // retiro izq de la T
dimH(T_X1, 14, 6, "5,50", 46);                // retiro der de la T
dimH(T_X0, T_X1, 6 + T_D, "3,00", 30);        // ancho de la T
dimV(6, 6 + T_D, T_X1, "9,00", 34);           // largo de la T

// ── norte ─────────────────────────────────────────────────────────────────
const nx = X(14) + 75, ny = OY + 30;
add(`<circle cx="${nx}" cy="${ny}" r="22" fill="none" stroke="#374151" stroke-width="1.2"/>`);
add(`<path d="M ${nx} ${ny-20} L ${nx-7} ${ny+6} L ${nx} ${ny} L ${nx+7} ${ny+6} Z" fill="#374151"/>`);
add(`<text x="${nx}" y="${ny-26}" text-anchor="middle" font-family="Helvetica,Arial" font-size="12" font-weight="700" fill="#374151">N</text>`);

// ── barra de escala ─────────────────────────────────────────────────────────
const sb = X(14) + 45, sby = OY + 300;
add(`<text x="${sb}" y="${sby-8}" font-family="Helvetica,Arial" font-size="10" fill="#6b7280">ESCALA GRÁFICA</text>`);
for (let i = 0; i < 5; i++) add(`<rect x="${sb + i*S}" y="${sby}" width="${S}" height="6" fill="${i%2?'#fff':'#374151'}" stroke="#374151" stroke-width="0.8"/>`);
[0,1,2,3,4,5].forEach(i => add(`<text x="${sb+i*S}" y="${sby+18}" text-anchor="middle" font-family="Helvetica,Arial" font-size="9" fill="#6b7280">${i}</text>`));
add(`<text x="${sb+5*S+10}" y="${sby+6}" font-family="Helvetica,Arial" font-size="9" fill="#6b7280">m</text>`);

// ── cuadro de superficies ───────────────────────────────────────────────────
const lx = X(14) + 45, ly = OY + 90, lw = 290;
add(`<rect x="${lx}" y="${ly}" width="${lw}" height="150" rx="6" fill="#ffffff" stroke="#e5e7eb"/>`);
add(`<text x="${lx+14}" y="${ly+26}" font-family="Helvetica,Arial" font-size="13" font-weight="700" fill="#111827">SUPERFICIE DE CUBIERTA</text>`);
const sup = [
  ["Cuerpo principal  14,00 × 6,00", "84,0 m²"],
  ["Extensión en T   3,00 × 9,00", "27,0 m²"],
  ["TOTAL VIVIENDA", "111,0 m²"],
];
sup.forEach(([a,b],i)=>{ const yy=ly+52+i*26; const bold=i===2;
  add(`<text x="${lx+14}" y="${yy}" font-family="Helvetica,Arial" font-size="12" fill="${bold?'#111827':'#374151'}" font-weight="${bold?700:400}">${a}</text>`);
  add(`<text x="${lx+lw-14}" y="${yy}" text-anchor="end" font-family="Helvetica,Arial" font-size="12" fill="${bold?'#111827':'#374151'}" font-weight="${bold?700:400}">${b}</text>`);
  if (bold) add(`<line x1="${lx+14}" y1="${yy-18}" x2="${lx+lw-14}" y2="${yy-18}" stroke="#e5e7eb"/>`);
});
add(`<text x="${lx+14}" y="${ly+138}" font-family="Helvetica,Arial" font-size="9.5" fill="#9ca3af">Vivienda elevada s/platea + pilotes. Cotas en metros.</text>`);

// ── cajetín / rótulo ─────────────────────────────────────────────────────────
const tx = OX - 70, tyB = OY + 6 * S + T_D * S + 60, tw = m(14) + 70;
add(`<rect x="${tx}" y="${tyB}" width="${tw}" height="70" fill="#1A3A5C"/>`);
add(`<text x="${tx+18}" y="${tyB+28}" font-family="Helvetica,Arial" font-size="16" font-weight="700" fill="#fff" letter-spacing=".5">VIVIENDA UNIFAMILIAR — RECONSTRUCCIÓN</text>`);
add(`<text x="${tx+18}" y="${tyB+48}" font-family="Helvetica,Arial" font-size="11" fill="#cdd9e6">Planta de perímetro y cubierta · Nivel acceso (elevado) · Esc. 1:100</text>`);
add(`<text x="${tx+18}" y="${tyB+62}" font-family="Helvetica,Arial" font-size="9" fill="#9bb3cc">BMC · METALOG SAS — Dolores, Uruguay · PROPUESTA s/croquis (interior sin subdividir)</text>`);
add(`<text x="${tx+tw-18}" y="${tyB+40}" text-anchor="end" font-family="Helvetica,Arial" font-size="11" fill="#cdd9e6">Lám. 01 · Perímetro/cubierta</text>`);

// ── ensamble SVG ─────────────────────────────────────────────────────────────
const CW = lx + lw + 40, CH = tyB + 70 + 30;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}" font-family="Helvetica,Arial">
<defs>
<pattern id="hatch" width="14" height="14" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
  <rect width="14" height="14" fill="#fbfaf7"/>
  <line x1="0" y1="0" x2="0" y2="14" stroke="#e9e4d8" stroke-width="1"/>
</pattern>
</defs>
<rect width="${CW}" height="${CH}" fill="#ffffff"/>
${out.join("\n")}
</svg>`;
const OUT = "docs/presupuestos/casa-incendio-dolores/plano-vivienda.svg";
writeFileSync(OUT, svg);
console.log("OK", CW, "x", CH, "->", OUT);
// Rasterizar a PNG (requiere @resvg/resvg-js):
//   node -e "const{Resvg}=require('@resvg/resvg-js');const fs=require('fs');const o='docs/presupuestos/casa-incendio-dolores/plano-vivienda';
//   fs.writeFileSync(o+'.png',new Resvg(fs.readFileSync(o+'.svg','utf8'),{fitTo:{mode:'width',value:2476},font:{loadSystemFonts:true}}).render().asPng())"
