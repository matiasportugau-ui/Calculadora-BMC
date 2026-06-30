#!/usr/bin/env node
/**
 * Generates 60 static HTML mockups: 5 studios × 4 layers × 3 breakpoints.
 * Run: node docs/team/design-competition/scripts/generate-mockups.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const STUDIOS = [
  { id: "tahoe", folder: "studio-1-tahoe", label: "Studio Tahoe", tagline: "Liquid Glass Regular" },
  { id: "operativo", folder: "studio-2-operativo", label: "Operativo Dense", tagline: "Time-saving ops" },
  { id: "warm", folder: "studio-3-warm", label: "Warm Commerce", tagline: "Applied AI warm" },
  { id: "industrial", folder: "studio-4-industrial", label: "Field Industrial", tagline: "Obra / tablet" },
  { id: "responsive", folder: "studio-5-responsive", label: "Responsive Systems Lab", tagline: "Mobile-first" },
];

const LAYERS = [
  { id: "L0", slug: "shell", title: "Shell & Navigation" },
  { id: "L1", slug: "wizard", title: "Calculator Wizard" },
  { id: "L2", slug: "visor", title: "Visor & BOM" },
  { id: "L3", slug: "hub", title: "Hub Modules" },
];

const BREAKPOINTS = [
  { slug: "mobile", label: "Mobile", width: 390, frame: "preview-frame--mobile" },
  { slug: "tablet", label: "Tablet", width: 834, frame: "preview-frame--tablet" },
  { slug: "desktop", label: "Desktop", width: 1280, frame: "preview-frame--desktop" },
];

function relShared(depth) {
  return "../".repeat(depth) + "_shared/";
}

function layerContent(layer, bp, studio) {
  const isMobile = bp.slug === "mobile";
  const isDesktop = bp.slug === "desktop";
  const cols = isMobile ? 1 : isDesktop ? 3 : 2;

  if (layer.slug === "shell") {
    const navItems = isMobile
      ? `<button class="btn btn-secondary touch-target" style="min-width:44px">☰</button>`
      : `<nav style="display:flex;gap:16px;font-size:13px;font-weight:500">
          <a href="#" style="color:var(--bmc-primary);text-decoration:none">Inicio</a>
          <a href="#" style="color:var(--bmc-text);text-decoration:none">Cotizaciones</a>
          <a href="#" style="color:var(--bmc-text);text-decoration:none">Operaciones</a>
          <a href="#" style="color:var(--bmc-text);text-decoration:none">Hub</a>
        </nav>`;
    return `
      <header class="chrome-glass" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;position:sticky;top:0;z-index:10">
        <strong style="color:var(--bmc-brand)">BMC Uruguay</strong>
        ${navItems}
        <span class="badge">${studio.label}</span>
      </header>
      <main style="padding:16px">
        <div class="card" style="padding:20px;margin-bottom:12px">
          <h2 style="margin:0 0 8px;font-size:18px">Acceso operativo</h2>
          <p style="margin:0 0 16px;color:var(--bmc-text-2);font-size:14px">Iniciá sesión para cotizar y administrar pedidos.</p>
          <button class="btn btn-primary" style="width:${isMobile ? "100%" : "auto"}">Continuar con Google</button>
        </div>
        <p style="font-size:12px;color:var(--bmc-text-2)">Capa L0 — shell, auth gate, nav ${bp.label.toLowerCase()}</p>
      </main>`;
  }

  if (layer.slug === "wizard") {
    const steps = ["Escenario", "Familia", "Espesor", "Dimensiones", "Estructura", "Proyecto"];
    const stepHtml = steps
      .map((s, i) => `<span style="padding:6px 10px;border-radius:999px;font-size:11px;background:${i === 3 ? "var(--bmc-primary)" : "var(--bmc-surface-alt)"};color:${i === 3 ? "#fff" : "var(--bmc-text-2)"}">${s}</span>`)
      .join("");
    return `
      <header class="chrome-glass" style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center">
        <strong style="font-size:14px">Solo Techo · Paso 4/11</strong>
        <span class="mono" style="font-size:13px;color:var(--bmc-success)">USD 12,450</span>
      </header>
      <div style="display:grid;grid-template-columns:${isMobile ? "1fr" : "1fr 1fr"};gap:16px;padding:16px">
        <section class="card" style="padding:16px">
          <h3 style="margin:0 0 12px;font-size:16px">Dimensiones (m)</h3>
          <label style="display:block;font-size:12px;color:var(--bmc-text-2);margin-bottom:4px">Largo zona 1</label>
          <input type="text" value="12,0" style="width:100%;padding:12px;border:1px solid var(--bmc-border);border-radius:var(--bmc-radius-sm);font-size:16px;margin-bottom:12px" />
          <label style="display:block;font-size:12px;color:var(--bmc-text-2);margin-bottom:4px">Ancho</label>
          <input type="text" value="8,5" style="width:100%;padding:12px;border:1px solid var(--bmc-border);border-radius:var(--bmc-radius-sm);font-size:16px" />
          <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">${stepHtml}</div>
        </section>
        ${isMobile ? "" : `<aside class="card" style="padding:16px;background:var(--bmc-surface-alt)">
          <p style="margin:0 0 8px;font-size:12px;color:var(--bmc-text-2)">Visor 2D (preview)</p>
          <div style="height:180px;border:1px dashed var(--bmc-border);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--bmc-text-3);font-size:12px">Planta techo · ISODEC EPS 100mm</div>
        </aside>`}
      </div>
      <footer style="padding:12px 16px;display:flex;justify-content:space-between;border-top:1px solid var(--bmc-border);background:var(--bmc-surface)">
        <button class="btn btn-secondary">Anterior</button>
        <button class="btn btn-primary">Siguiente</button>
      </footer>`;
  }

  if (layer.slug === "visor") {
    return `
      <header style="padding:12px 16px;border-bottom:1px solid var(--bmc-border);background:var(--bmc-surface)">
        <strong>Estructura · Visor visual</strong>
      </header>
      <div style="display:grid;grid-template-columns:${cols === 1 ? "1fr" : cols === 2 ? "1.2fr 0.8fr" : "1fr 1fr 320px"};gap:12px;padding:12px;min-height:400px">
        <div class="card" style="padding:12px;min-height:280px">
          <svg viewBox="0 0 400 240" width="100%" style="background:#f0f4f8;border-radius:8px">
            <rect x="40" y="40" width="320" height="160" fill="#e8f1fb" stroke="#0071e3" stroke-width="2"/>
            <text x="200" y="130" text-anchor="middle" fill="#1a3a5c" font-size="14">T-01 … T-08 · 12,0 × 8,5 m</text>
          </svg>
        </div>
        ${cols >= 2 ? `<aside class="card" style="padding:12px">
          <h4 style="margin:0 0 8px;font-size:13px">BOM resumen</h4>
          <table><tr><th>Ítem</th><th>Cant.</th><th>USD</th></tr>
          <tr><td>Panel ISODEC 100</td><td class="mono">84</td><td class="mono">3,456</td></tr>
          <tr><td>Fijación techo</td><td class="mono">420</td><td class="mono">892</td></tr>
          <tr><td><strong>Subtotal s/IVA</strong></td><td></td><td class="mono"><strong>12,450</strong></td></tr></table>
        </aside>` : ""}
        ${cols >= 3 ? `<div class="card" style="padding:12px;background:var(--bmc-surface-alt)">
          <p style="font-size:12px;margin:0 0 8px">Panelin</p>
          <div style="padding:10px;background:var(--bmc-surface);border-radius:8px;font-size:13px;border:1px solid var(--bmc-border)">¿Querés revisar autoportancia en zona 2?</div>
        </div>` : ""}
      </div>`;
  }

  // hub
  const tableCols = isMobile ? 2 : 5;
  return `
    <header class="chrome-glass" style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
      <strong>Hub · Cotizaciones</strong>
      <button class="btn btn-primary" style="min-height:36px;padding:0 12px;font-size:13px">+ Nueva</button>
    </header>
    <div style="padding:16px">
      <div class="kpi-strip" style="display:grid;grid-template-columns:repeat(${isMobile ? 2 : 4},1fr);gap:8px;margin-bottom:16px">
        ${["Abiertas 12", "Esta semana 4", "Sin enviar 2", "Ganadas 8"].map((k) => `<div class="card kpi" style="padding:12px"><div style="font-size:11px;color:var(--bmc-text-2)">${k.split(" ")[0]}</div><div class="mono" style="font-size:20px;font-weight:600">${k.split(" ")[1]}</div></div>`).join("")}
      </div>
      <div class="card" style="overflow:hidden">
        <table><thead><tr>${isMobile ? "<th>Cliente</th><th>USD</th>" : "<th>Cliente</th><th>Proyecto</th><th>Estado</th><th>Actualizado</th><th>USD</th>"}</tr></thead>
        <tbody>
          <tr><td>Constructora Sur</td>${isMobile ? "" : "<td>Galpón Pando</td><td><span class='badge'>Pendiente</span></td><td>Hoy</td>"}<td class="mono">18,200</td></tr>
          <tr><td>Metalúrgica EST</td>${isMobile ? "" : "<td>Techo zona industrial</td><td><span class='badge'>Enviada</span></td><td>Ayer</td>"}<td class="mono">9,840</td></tr>
        </tbody></table>
      </div>
      <p style="font-size:11px;color:var(--bmc-text-2);margin-top:12px">Rutas: /hub/cotizaciones · /hub/wa · /hub/ml · /hub/canales · /hub/admin/users</p>
    </div>`;
}

function buildHtml(studio, layer, bp) {
  const shared = relShared(1);
  return `<!DOCTYPE html>
<html lang="es" data-studio="${studio.id}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${bp.width}, initial-scale=1" />
  <title>${studio.label} · ${layer.title} · ${bp.label}</title>
  <link rel="stylesheet" href="${shared}tokens-base.css" />
  <link rel="stylesheet" href="${shared}breakpoints.css" />
  <link rel="stylesheet" href="${shared}studio-themes.css" />
  <style>
    body { padding: 16px; background: #e8e8ed; }
    a.back { font-size: 12px; color: var(--bmc-primary); }
  </style>
</head>
<body>
  <p class="preview-meta"><a class="back" href="../../index.html">← Competition hub</a> · ${studio.label} · ${layer.id} ${layer.title} · ${bp.label} (${bp.width}px)</p>
  <div class="preview-frame ${bp.frame}" data-studio="${studio.id}">
    ${layerContent(layer, bp, studio)}
  </div>
</body>
</html>`;
}

const indexLinks = [];

for (const studio of STUDIOS) {
  const dir = join(ROOT, studio.folder);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  for (const layer of LAYERS) {
    for (const bp of BREAKPOINTS) {
      const filename = `${layer.id}-${layer.slug}-${bp.slug}.html`;
      const filepath = join(dir, filename);
      writeFileSync(filepath, buildHtml(studio, layer, bp), "utf8");
      indexLinks.push({
        studio: studio.label,
        folder: studio.folder,
        file: filename,
        layer: layer.id,
        bp: bp.label,
      });
    }
  }
}

writeFileSync(join(ROOT, "mockup-index.json"), JSON.stringify(indexLinks, null, 2), "utf8");
console.log(`Generated ${indexLinks.length} mockups across ${STUDIOS.length} studios.`);
