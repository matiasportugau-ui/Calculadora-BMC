#!/usr/bin/env node
/**
 * Generates 18 premium preview pages: 6 studios × 3 breakpoints.
 * Run: node docs/team/design-competition/scripts/generate-premium-previews.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "premium-previews");

const STUDIOS = [
  { id: "tahoe", folder: "studio-1-tahoe", label: "Studio Tahoe", rec: "Liquid Glass Regular — nav blur 14–20px, saturate 165%", altA: "Materialize transition on modal", altB: "WWDC25 Regular only (no Clear on forms)" },
  { id: "operativo", folder: "studio-2-operativo", label: "Operativo Dense", rec: "Glass only KPI strip header (8px blur)", altA: "Compact glass pill filters", altB: "Solid list + glass inspector drawer" },
  { id: "warm", folder: "studio-3-warm", label: "Warm Commerce", rec: "No glass on ops data; solid editorial cards", altA: "Soft glass marketing CTA band", altB: "Glass nav only + paper cards" },
  { id: "industrial", folder: "studio-4-industrial", label: "Field Industrial", rec: "Solid panels; glass floating action bar only", altA: "Outdoors solid high-contrast mode", altB: "Tablet glass sidebar collapse" },
  { id: "responsive", folder: "studio-5-responsive", label: "Responsive Systems Lab", rec: "Mobile solid nav; tablet+ glass", altA: "Bottom sheet glass (mobile hub)", altB: "Floating island nav iOS 26" },
  { id: "premium", folder: "studio-6-bmc-glass", label: "BMC Glass Premium", rec: "Downloads showcase — refract + token playground", altA: "Day/night on same page", altB: "Tint presets neutro/frío/marca/cálido" },
];

const BREAKPOINTS = [
  { slug: "mobile", label: "Mobile", width: 390, cls: "preview-frame--mobile" },
  { slug: "tablet", label: "Tablet", width: 834, cls: "preview-frame--tablet" },
  { slug: "desktop", label: "Desktop", width: 1280, cls: "preview-frame--desktop" },
];

function calcDemo(bad, cols) {
  const tableBg = bad ? "glass-table-bad" : "glass-table-solid";
  const msg = bad
    ? "Vidrio sobre datos: contraste &lt; 4.5:1 — Incorrecto"
    : "Vidrio solo en chrome; tabla sólida — Correcto";
  const msgClass = bad ? "color:#fca5a5" : "color:#6ee7b7";
  return `
    <section style="padding:12px">
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button type="button" onclick="setBad(false)" id="btnOk" style="padding:6px 12px;border-radius:8px;border:none;font-weight:600;cursor:pointer">Correcto</button>
        <button type="button" onclick="setBad(true)" id="btnBad" style="padding:6px 12px;border-radius:8px;border:none;font-weight:600;cursor:pointer">Incorrecto</button>
      </div>
      <div class="glass" style="--g-radius:16px;padding:0;overflow:hidden" id="calcWrap">
        <div class="glass glass-minimal" style="--g-radius:0;display:flex;align-items:center;gap:8px;padding:10px 14px;border:none;border-bottom:1px solid rgba(255,255,255,0.1)">
          <strong style="font-size:13px">Cotizador · Obra Maldonado</strong>
          <span class="tnum" style="margin-left:auto;font-size:12px;color:rgb(var(--g-accent))">USD 18.940</span>
        </div>
        <div class="${tableBg}" id="calcTable" style="max-height:200px;overflow:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="color:var(--g-text-2);text-transform:uppercase;font-size:10px">
              <th style="padding:8px 12px;text-align:left">Producto</th>
              ${cols >= 2 ? '<th style="padding:8px 12px;text-align:right">m²</th>' : ""}
              <th style="padding:8px 12px;text-align:right">USD</th>
            </tr></thead>
            <tbody class="tnum">
              <tr><td style="padding:8px 12px">ISODEC EPS 100</td>${cols >= 2 ? '<td style="padding:8px 12px;text-align:right">420</td>' : ""}<td style="padding:8px 12px;text-align:right">6.300</td></tr>
              <tr><td style="padding:8px 12px">ISOROOF 5 grecas</td>${cols >= 2 ? '<td style="padding:8px 12px;text-align:right">318</td>' : ""}<td style="padding:8px 12px;text-align:right">5.412</td></tr>
            </tbody>
          </table>
        </div>
        <div class="glass glass-minimal" style="--g-radius:0;display:flex;gap:8px;padding:10px 14px;border:none;border-top:1px solid rgba(255,255,255,0.1)">
          <button style="padding:8px 14px;border-radius:10px;border:none;background:rgb(var(--g-accent));color:#fff;font-weight:600;font-size:12px">Calcular</button>
          <button style="padding:8px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:inherit;font-size:12px">Exportar PDF</button>
        </div>
      </div>
      <p id="calcMsg" style="font-size:12px;margin-top:8px;${msgClass}">${msg}</p>
    </section>`;
}

function buildPage(studio, bp) {
  const cols = bp.slug === "mobile" ? 1 : 2;
  const navClass = studio.id === "responsive" ? "glass glass-mobile-solid" : studio.id === "warm" ? "glass glass-nav-only" : "glass glass-refract";
  const refract = studio.id === "premium" || studio.id === "tahoe" ? " glass-refract" : studio.id === "operativo" ? " glass-minimal" : "";

  return `<!DOCTYPE html>
<html lang="es" data-appearance="day" data-studio="${studio.id}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=${bp.width}, initial-scale=1"/>
<title>${studio.label} · Premium · ${bp.label}</title>
<link rel="stylesheet" href="../_shared/bmc-glass-premium.css"/>
<style>
  .pattern-grid { display: grid; gap: 12px; padding: 12px; grid-template-columns: ${bp.slug === "desktop" ? "1fr 1fr 1fr" : bp.slug === "tablet" ? "1fr 1fr" : "1fr"}; }
  .pattern-card { padding: 12px; border-radius: 12px; background: var(--g-solid-bg); border: 1px solid rgba(0,0,0,0.06); font-size: 12px; }
  .kpi-row { display: grid; grid-template-columns: repeat(${bp.slug === "mobile" ? 2 : 4}, 1fr); gap: 8px; padding: 12px; }
  .kpi { padding: 10px; border-radius: 10px; background: var(--g-solid-bg); border: 1px solid rgba(0,0,0,0.06); }
  .btn-toggle { padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.15); background: var(--g-solid-bg); cursor: pointer; font-size: 12px; font-weight: 600; }
  .btn-toggle.active { background: rgb(var(--g-accent)); color: #fff; border-color: transparent; }
</style>
</head>
<body>
<div class="app-bg-layer" aria-hidden="true"></div>
<div class="preview-toolbar">
  <a href="../index.html" style="font-size:12px;color:rgb(var(--g-accent))">← Hub</a>
  <strong style="font-size:13px">${studio.label}</strong>
  <span style="font-size:11px;color:var(--g-text-2)">${bp.label} ${bp.width}px</span>
  <button type="button" class="btn-toggle active" id="btnDay" onclick="setAppearance('day')">Día</button>
  <button type="button" class="btn-toggle" id="btnNight" onclick="setAppearance('night')">Noche</button>
</div>

<div class="preview-frame ${bp.cls}">
  <nav class="${navClass}${refract}" style="--g-radius:14px;margin:12px;display:flex;align-items:center;gap:8px;padding:10px 14px">
    <strong style="color:rgb(var(--g-brand))">BMC Uruguay</strong>
    ${bp.slug !== "mobile" ? '<span style="font-size:12px;color:var(--g-text-2);margin-left:12px">Hub · Cotizaciones</span>' : ""}
    <span style="margin-left:auto;font-size:11px" class="badge badge-rec">recomendado</span>
  </nav>

  <div class="pattern-grid">
    <div class="pattern-card">
      <span class="badge badge-rec">recomendado</span>
      <p style="margin:8px 0 0"><strong>${studio.rec}</strong></p>
    </div>
    <div class="pattern-card">
      <span class="badge badge-uso">más usado</span>
      <p style="margin:8px 0 0">Patrón industria alineado a ${studio.label}</p>
    </div>
    <div class="pattern-card">
      <span class="badge badge-alt">alternativa A</span>
      <p style="margin:8px 0 0">${studio.altA}</p>
    </div>
    ${bp.slug !== "mobile" ? `<div class="pattern-card"><span class="badge badge-alt">alternativa B</span><p style="margin:8px 0 0">${studio.altB}</p></div>` : ""}
  </div>

  <div class="kpi-row">
    ${["Abiertas 12", "Semana 4", "Sin enviar 2", "Ganadas 8"].slice(0, bp.slug === "mobile" ? 2 : 4).map((k) => {
      const [l, v] = k.split(" ");
      return `<div class="kpi glass-content-solid"><div style="font-size:10px;color:var(--g-text-2)">${l}</div><div class="tnum" style="font-size:18px;font-weight:700">${v}</div></div>`;
    }).join("")}
  </div>

  ${calcDemo(false, cols)}
</div>

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <filter id="bmcGlass" x="-25%" y="-25%" width="150%" height="150%">
    <feTurbulence type="fractalNoise" baseFrequency="0.011 0.013" numOctaves="2" seed="42" result="n"/>
    <feGaussianBlur in="n" stdDeviation="1.5" result="sn"/>
    <feDisplacementMap in="SourceGraphic" in2="sn" scale="24" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>

<script>
function setAppearance(mode) {
  document.documentElement.dataset.appearance = mode;
  document.getElementById('btnDay').classList.toggle('active', mode === 'day');
  document.getElementById('btnNight').classList.toggle('active', mode === 'night');
}
function setBad(bad) {
  const t = document.getElementById('calcTable');
  const m = document.getElementById('calcMsg');
  t.className = bad ? 'glass-table-bad' : 'glass-table-solid';
  m.textContent = bad ? 'Vidrio sobre datos: contraste < 4.5:1 — Incorrecto' : 'Vidrio solo en chrome; tabla sólida — Correcto';
  m.style.color = bad ? '#fca5a5' : '#6ee7b7';
  document.getElementById('btnOk').style.background = bad ? '' : 'rgb(var(--g-accent))';
  document.getElementById('btnOk').style.color = bad ? '' : '#fff';
  document.getElementById('btnBad').style.background = bad ? '#dc2626' : '';
  document.getElementById('btnBad').style.color = bad ? '#fff' : '';
}
</script>
</body>
</html>`;
}

const indexLinks = [];
for (const studio of STUDIOS) {
  const dir = join(ROOT, studio.folder);
  mkdirSync(dir, { recursive: true });
  for (const bp of BREAKPOINTS) {
    const file = `premium-${bp.slug}.html`;
    writeFileSync(join(dir, file), buildPage(studio, bp), "utf8");
    indexLinks.push({ studio: studio.label, folder: studio.folder, file, bp: bp.label });
  }
}

let indexHtml = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"/><title>BMC Premium Glass Previews</title>
<link rel="stylesheet" href="_shared/bmc-glass-premium.css"/>
<style>body{max-width:1100px;margin:0 auto;padding:24px;font-family:var(--g-font)}
h1{color:rgb(var(--g-brand))}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;margin:16px 0}
.grid a{display:block;padding:10px;background:#fff;border:1px solid #e5e5ea;border-radius:8px;text-decoration:none;color:#1d1d1f;font-size:13px}
.studio{margin:24px 0;padding:16px;border:1px solid #e5e5ea;border-radius:12px;background:#fff}</style></head><body>
<h1>BMC Premium Glass Previews</h1>
<p>6 studios × 3 breakpoints = 18 pages. Each includes day/night toggle + Correcto/Incorrecto calc demo.</p>
<p><a href="STUDIO-PREVIEW-BRIEFS.md">Briefs</a> · <a href="TREND-ALTERNATIVES-MATRIX.md">Trend matrix</a> · <a href="../index.html">Original competition</a></p>`;

for (const s of [...new Set(indexLinks.map((l) => l.studio))]) {
  indexHtml += `<section class="studio"><h2>${s}</h2><div class="grid">`;
  for (const l of indexLinks.filter((x) => x.studio === s)) {
    indexHtml += `<a href="${l.folder}/${l.file}">${l.bp}</a>`;
  }
  indexHtml += `</div></section>`;
}
indexHtml += `</body></html>`;
writeFileSync(join(ROOT, "index.html"), indexHtml);
writeFileSync(join(ROOT, "premium-index.json"), JSON.stringify(indexLinks, null, 2));
console.log(`Generated ${indexLinks.length} premium previews.`);
