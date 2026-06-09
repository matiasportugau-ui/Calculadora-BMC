// Generador de plano arquitectónico profesional a partir del croquis.
// Interpretación del croquis (borrador para revisión del cliente).
import { writeFileSync } from "node:fs";

const S = 52;                 // px por metro
const OX = 150, OY = 140;     // origen del plano (px)
const m = (v) => v * S;
const X = (v) => OX + v * S;
const Y = (v) => OY + v * S;

const WEXT = 0.20 * S;        // muro exterior 20 cm
const WINT = 0.10 * S;        // tabique 10 cm
const INK = "#1f2937";

const out = [];
const add = (s) => out.push(s);

// ── helpers ──────────────────────────────────────────────────────────────
function wall(x1, y1, x2, y2, w = WINT) {
  add(`<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="${INK}" stroke-width="${w}" stroke-linecap="square"/>`);
}
function roomFill(x, y, w, h, fill) {
  add(`<rect x="${X(x)}" y="${Y(y)}" width="${m(w)}" height="${m(h)}" fill="${fill}"/>`);
}
function label(x, y, name, area, sub) {
  add(`<text x="${X(x)}" y="${Y(y)}" text-anchor="middle" font-family="Helvetica,Arial" font-size="14" font-weight="700" fill="#111827" letter-spacing=".5">${name}</text>`);
  if (area) add(`<text x="${X(x)}" y="${Y(y) + 16}" text-anchor="middle" font-family="Helvetica,Arial" font-size="11" fill="#6b7280">${area}</text>`);
  if (sub) add(`<text x="${X(x)}" y="${Y(y) - 16}" text-anchor="middle" font-family="Helvetica,Arial" font-size="9.5" fill="#9ca3af" letter-spacing="2">${sub}</text>`);
}
// puerta: hueco blanco + hoja + arco de barrido
function door(x, y, size, dir) {
  // dir: 'R','L' (horizontal wall) hinge orientation; 'D','U' vertical wall
  const sz = size * S;
  if (dir === "Rd" || dir === "Ld") { // hueco en muro vertical, batido hacia abajo
    add(`<rect x="${X(x) - WEXT/2 - 1}" y="${Y(y)}" width="${WEXT + 2}" height="${sz}" fill="#fff"/>`);
    const hx = X(x), hy = dir === "Rd" ? Y(y) : Y(y + size);
    add(`<line x1="${hx}" y1="${dir==="Rd"?Y(y):Y(y+size)}" x2="${hx + (dir==="Rd"?sz:-sz)}" y2="${dir==="Rd"?Y(y):Y(y+size)}" stroke="#9ca3af" stroke-width="1.4"/>`);
    add(`<path d="M ${hx + (dir==="Rd"?sz:-sz)} ${dir==="Rd"?Y(y):Y(y+size)} A ${sz} ${sz} 0 0 ${dir==="Rd"?1:0} ${hx} ${dir==="Rd"?Y(y+size):Y(y)}" fill="none" stroke="#cbd5e1" stroke-width="1"/>`);
  } else { // hueco en muro horizontal
    add(`<rect x="${X(x)}" y="${Y(y) - WEXT/2 - 1}" width="${sz}" height="${WEXT + 2}" fill="#fff"/>`);
    const hx = dir === "R" ? X(x) : X(x + size), hy = Y(y);
    add(`<line x1="${hx}" y1="${hy}" x2="${hx}" y2="${hy + sz}" stroke="#9ca3af" stroke-width="1.4"/>`);
    add(`<path d="M ${hx} ${hy + sz} A ${sz} ${sz} 0 0 ${dir==="R"?0:1} ${dir==="R"?X(x+size):X(x-size)} ${hy}" fill="none" stroke="#cbd5e1" stroke-width="1"/>`);
  }
}
// ventana en muro
function win(x1, y1, x2, y2) {
  const horiz = y1 === y2;
  add(`<rect x="${X(x1) - (horiz?0:WEXT/2)}" y="${Y(y1) - (horiz?WEXT/2:0)}" width="${horiz?m(x2-x1):WEXT}" height="${horiz?WEXT:m(y2-y1)}" fill="#fff"/>`);
  add(`<line x1="${X(x1)}" y1="${Y(y1)}" x2="${X(x2)}" y2="${Y(y2)}" stroke="#2563eb" stroke-width="2.4"/>`);
  if (horiz) { add(`<line x1="${X(x1)}" y1="${Y(y1)-3}" x2="${X(x2)}" y2="${Y(y2)-3}" stroke="#93c5fd" stroke-width="1"/>`); add(`<line x1="${X(x1)}" y1="${Y(y1)+3}" x2="${X(x2)}" y2="${Y(y2)+3}" stroke="#93c5fd" stroke-width="1"/>`); }
  else { add(`<line x1="${X(x1)-3}" y1="${Y(y1)}" x2="${X(x2)-3}" y2="${Y(y2)}" stroke="#93c5fd" stroke-width="1"/>`); add(`<line x1="${X(x1)+3}" y1="${Y(y1)}" x2="${X(x2)+3}" y2="${Y(y2)}" stroke="#93c5fd" stroke-width="1"/>`); }
}
// cota
function dimH(x1, x2, y, txt, off = 0) {
  const yy = Y(y) + off;
  add(`<line x1="${X(x1)}" y1="${yy}" x2="${X(x2)}" y2="${yy}" stroke="#b91c1c" stroke-width="1"/>`);
  for (const x of [x1, x2]) add(`<line x1="${X(x)}" y1="${yy-4}" x2="${X(x)}" y2="${yy+4}" stroke="#b91c1c" stroke-width="1"/>`);
  add(`<text x="${(X(x1)+X(x2))/2}" y="${yy-5}" text-anchor="middle" font-family="Helvetica,Arial" font-size="12" font-weight="700" fill="#b91c1c">${txt}</text>`);
}
function dimV(y1, y2, x, txt, off = 0) {
  const xx = X(x) + off;
  add(`<line x1="${xx}" y1="${Y(y1)}" x2="${xx}" y2="${Y(y2)}" stroke="#b91c1c" stroke-width="1"/>`);
  for (const y of [y1, y2]) add(`<line x1="${xx-4}" y1="${Y(y)}" x2="${xx+4}" y2="${Y(y)}" stroke="#b91c1c" stroke-width="1"/>`);
  add(`<text x="${xx-6}" y="${(Y(y1)+Y(y2))/2}" text-anchor="middle" font-family="Helvetica,Arial" font-size="12" font-weight="700" fill="#b91c1c" transform="rotate(-90 ${xx-6} ${(Y(y1)+Y(y2))/2})">${txt}</text>`);
}
function stairs(x, y, w, h, n, label_) {
  const step = h / n;
  add(`<rect x="${X(x)}" y="${Y(y)}" width="${m(w)}" height="${m(h)}" fill="#eef2ff"/>`);
  for (let i = 1; i < n; i++) add(`<line x1="${X(x)}" y1="${Y(y+i*step)}" x2="${X(x+w)}" y2="${Y(y+i*step)}" stroke="#6366f1" stroke-width="1"/>`);
  add(`<rect x="${X(x)}" y="${Y(y)}" width="${m(w)}" height="${m(h)}" fill="none" stroke="#6366f1" stroke-width="1.2"/>`);
  add(`<line x1="${X(x+w/2)}" y1="${Y(y+h-0.2)}" x2="${X(x+w/2)}" y2="${Y(y+0.3)}" stroke="#4338ca" stroke-width="1.4" marker-end="url(#arr)"/>`);
  add(`<text x="${X(x+w/2)}" y="${Y(y+h)+14}" text-anchor="middle" font-family="Helvetica,Arial" font-size="10" font-weight="700" fill="#4338ca">${label_}</text>`);
}

// ── fondos de ambientes ────────────────────────────────────────────────────
const FA = "#fbfaf7", FB = "#f4f1ea", FW = "#eaf2f8";
roomFill(0, 0, 14, 6, FA);                 // cuerpo principal
roomFill(4, 6, 6, 3, FB);                  // extensión T
// húmedos
roomFill(7.6, 0, 1.8, 3, FW);              // Baño 1
roomFill(1.8, 3.4, 1.8, 2.6, FW);          // Baño 2

// ── ambientes (líneas de tabique) ──────────────────────────────────────────
// verticales internas
[3.6, 7.6, 9.4, 11.7].forEach((x) => wall(x, 0, x, 6));
// izquierda: dorm2 / baño2 / placard
wall(0, 3.4, 3.6, 3.4);
wall(1.8, 3.4, 1.8, 6);
// núcleo central B1 / WIC
wall(7.6, 3, 9.4, 3);
// T internos
wall(7, 6, 7, 9);

// ── muros exteriores (contorno principal + T) ──────────────────────────────
add(`<path d="M ${X(0)} ${Y(0)} H ${X(14)} V ${Y(6)} H ${X(10)} V ${Y(9)} H ${X(4)} V ${Y(6)} H ${X(0)} Z" fill="none" stroke="${INK}" stroke-width="${WEXT}" stroke-linejoin="miter"/>`);

// ── etiquetas ───────────────────────────────────────────────────────────────
label(1.8, 1.9, "DORMITORIO 2", "12,2 m²", "");
label(2.7, 4.9, "PLACARD", "", "");
label(1.0, 4.9, "BAÑO 2", "", "");
label(5.6, 3.0, "COCINA · COMEDOR · LIVING", "24,0 m²", "ESTAR PRINCIPAL");
label(8.5, 1.5, "BAÑO 1", "5,4 m²", "");
label(8.5, 4.5, "VESTIDOR", "5,4 m²", "W.I.C.");
label(10.55, 3.0, "DORM. 1", "13,8 m²", "");
label(12.85, 3.0, "DORM. PPAL", "13,8 m²", "SUITE");
label(8.5, 7.5, "DORM. 3 / ESTUDIO", "9,0 m²", "");

// escalera de acceso (vivienda elevada s/pilotes)
stairs(4.3, 6.3, 2.4, 2.4, 9, "ESCALERA ACCESO");
label(5.5, 6.05, "HALL", "", "");

// ── aberturas ───────────────────────────────────────────────────────────────
// puertas interiores
door(3.6, 1.6, 0.9, "Rd");   // K-LC ↔ dorm2
door(7.6, 1.2, 0.9, "Rd");   // baño1
door(7.6, 4.2, 0.9, "Rd");   // wic
door(9.4, 1.5, 0.9, "Rd");   // dorm1
door(11.7, 1.5, 0.9, "Rd");  // dorm ppal
door(1.8, 4.2, 0.8, "Rd");   // baño2
door(7, 7.2, 0.9, "Rd");     // dorm3
// puerta principal (en T, abajo) + acceso
door(6.4, 9, 1.0, "R");
add(`<text x="${X(7.0)}" y="${Y(9)+34}" text-anchor="middle" font-family="Helvetica,Arial" font-size="10" font-weight="700" fill="#374151">ACCESO PRINCIPAL ▲</text>`);
// ventanas exteriores
win(0, 1.4, 0, 2.6);          // dorm2 izq
win(1.0, 0, 2.6, 0);          // dorm2 frente
win(4.4, 0, 6.8, 0);          // K-LC frente (ventanal)
win(10.0, 0, 11.4, 0);        // dorm1 frente
win(12.2, 0, 13.6, 0);        // ppal frente
win(14, 1.4, 14, 4.6);        // ppal/dorm1 lateral der
win(0, 4.0, 0, 5.4);          // baño2/placard izq
win(10, 7.0, 10, 8.4);        // dorm3 der

// ── cotas ───────────────────────────────────────────────────────────────────
dimH(0, 14, 0, "14,00", -60);                       // total superior
[[0,3.6,"3,60"],[3.6,7.6,"4,00"],[7.6,9.4,"1,80"],[9.4,11.7,"2,30"],[11.7,14,"2,30"]].forEach(([a,b,t]) => dimH(a,b,0,t,-32));
dimV(0, 6, 0, "6,00", -55);                          // total izq
dimH(4, 10, 9, "6,00", 56);                          // T inferior
dimV(6, 9, 10, "3,00", 50);                          // T derecha

// ── norte + escala ──────────────────────────────────────────────────────────
const nx = X(14) + 70, ny = OY + 30;
add(`<circle cx="${nx}" cy="${ny}" r="22" fill="none" stroke="#374151" stroke-width="1.2"/>`);
add(`<path d="M ${nx} ${ny-20} L ${nx-7} ${ny+6} L ${nx} ${ny} L ${nx+7} ${ny+6} Z" fill="#374151"/>`);
add(`<text x="${nx}" y="${ny-26}" text-anchor="middle" font-family="Helvetica,Arial" font-size="12" font-weight="700" fill="#374151">N</text>`);
// barra de escala 0-5 m
const sb = X(14) + 40, sby = OY + 470;
add(`<text x="${sb}" y="${sby-8}" font-family="Helvetica,Arial" font-size="10" fill="#6b7280">ESCALA GRÁFICA</text>`);
for (let i = 0; i < 5; i++) add(`<rect x="${sb + i*S}" y="${sby}" width="${S}" height="6" fill="${i%2?'#fff':'#374151'}" stroke="#374151" stroke-width="0.8"/>`);
[0,1,2,3,4,5].forEach(i => add(`<text x="${sb+i*S}" y="${sby+18}" text-anchor="middle" font-family="Helvetica,Arial" font-size="9" fill="#6b7280">${i}</text>`));
add(`<text x="${sb+5*S+10}" y="${sby+6}" font-family="Helvetica,Arial" font-size="9" fill="#6b7280">m</text>`);

// ── leyenda / cuadro de notas ─────────────────────────────────────────────
const lx = X(14) + 40, ly = OY + 90, lw = 280;
add(`<rect x="${lx}" y="${ly}" width="${lw}" height="318" rx="6" fill="#ffffff" stroke="#e5e7eb"/>`);
add(`<text x="${lx+14}" y="${ly+24}" font-family="Helvetica,Arial" font-size="13" font-weight="700" fill="#111827">REFERENCIAS</text>`);
const leg = [
  ["#1f2937","Muro exterior 0,20 m"],
  ["#6b7280","Tabique interior 0,10 m"],
  ["#2563eb","Ventana"],
  ["#cbd5e1","Puerta (barrido)"],
  ["#6366f1","Escalera (sube ▲)"],
  ["#eaf2f8","Local húmedo"],
];
leg.forEach(([c,t],i)=>{ const yy=ly+44+i*22; add(`<rect x="${lx+14}" y="${yy-9}" width="22" height="11" fill="${c}"/>`); add(`<text x="${lx+44}" y="${yy}" font-family="Helvetica,Arial" font-size="11" fill="#374151">${t}</text>`); });
add(`<line x1="${lx+14}" y1="${ly+182}" x2="${lx+lw-14}" y2="${ly+182}" stroke="#e5e7eb"/>`);
add(`<text x="${lx+14}" y="${ly+202}" font-family="Helvetica,Arial" font-size="12" font-weight="700" fill="#111827">SUPERFICIES</text>`);
const sup = ["Cuerpo principal 14×6 ......... 84,0 m²","Extensión en T 6×3 ............... 18,0 m²","TOTAL CUBIERTO .................. 102,0 m²"];
sup.forEach((t,i)=>add(`<text x="${lx+14}" y="${ly+222+i*18}" font-family="Helvetica,Arial" font-size="11" fill="${i===2?'#111827':'#374151'}" font-weight="${i===2?700:400}">${t}</text>`));
add(`<text x="${lx+14}" y="${ly+292}" font-family="Helvetica,Arial" font-size="9.5" fill="#9ca3af">Vivienda elevada s/platea + pilotes.</text>`);
add(`<text x="${lx+14}" y="${ly+306}" font-family="Helvetica,Arial" font-size="9.5" fill="#9ca3af">Cotas en metros. Medidas a verificar en obra.</text>`);

// ── cajetín / rótulo ─────────────────────────────────────────────────────────
const W = X(14) + lw + 80;
const tx = OX - 70, tyB = OY + 470, tw = m(14) + 70;
add(`<rect x="${tx}" y="${tyB}" width="${tw}" height="70" fill="#1A3A5C"/>`);
add(`<text x="${tx+18}" y="${tyB+28}" font-family="Helvetica,Arial" font-size="16" font-weight="700" fill="#fff" letter-spacing=".5">VIVIENDA UNIFAMILIAR — RECONSTRUCCIÓN</text>`);
add(`<text x="${tx+18}" y="${tyB+48}" font-family="Helvetica,Arial" font-size="11" fill="#cdd9e6">Planta arquitectónica · Nivel acceso (elevado) · Esc. 1:100</text>`);
add(`<text x="${tx+18}" y="${tyB+62}" font-family="Helvetica,Arial" font-size="9" fill="#9bb3cc">BMC · METALOG SAS — Dolores, Uruguay · PROPUESTA s/croquis del cliente (borrador para revisión)</text>`);
add(`<text x="${tx+tw-18}" y="${tyB+40}" text-anchor="end" font-family="Helvetica,Arial" font-size="11" fill="#cdd9e6">Lám. 01 · Planta general</text>`);

// ── ensamble SVG ─────────────────────────────────────────────────────────────
const CW = W, CH = OY + 560;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}" font-family="Helvetica,Arial">
<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#4338ca"/></marker></defs>
<rect width="${CW}" height="${CH}" fill="#ffffff"/>
${out.join("\n")}
</svg>`;
const OUT = "docs/presupuestos/casa-incendio-dolores/plano-vivienda.svg";
writeFileSync(OUT, svg);
console.log("OK", CW, "x", CH, "->", OUT);
// Rasterizar a PNG (requiere @resvg/resvg-js):
//   node -e "const{Resvg}=require('@resvg/resvg-js');const fs=require('fs');const o='docs/presupuestos/casa-incendio-dolores/plano-vivienda';
//   fs.writeFileSync(o+'.png',new Resvg(fs.readFileSync(o+'.svg','utf8'),{fitTo:{mode:'width',value:2476},font:{loadSystemFonts:true}}).render().asPng())"
