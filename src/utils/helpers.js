// ═══════════════════════════════════════════════════════════════════════════
// src/utils/helpers.js — BOM override helpers, print/PDF utilities
// ═══════════════════════════════════════════════════════════════════════════

// ── Override helpers ─────────────────────────────────────────────────────────

export function createLineId(groupTitle, idx) { return groupTitle.toUpperCase().replace(/\s/g, "_") + "-" + idx; }

export function applyOverrides(groups, overrides) {
  return groups.map(g => ({ ...g, items: g.items.map((item, idx) => {
    const lid = createLineId(g.title, idx);
    const ovr = overrides && overrides[lid];
    if (!ovr) return { ...item, isOverridden: false, lineId: lid };
    const patched = { ...item, isOverridden: true, lineId: lid };
    if (ovr.field === "cant") { patched.cant = ovr.value; patched.total = +(ovr.value * patched.pu).toFixed(2); }
    else if (ovr.field === "pu") { patched.pu = ovr.value; patched.total = +(patched.cant * ovr.value).toFixed(2); }
    return patched;
  }) }));
}

export function bomToGroups(result) {
  if (!result || result.error) return [];
  const groups = [];

  if (result.allItems) {
    const panelItems = result.allItems.filter(i => i.unidad === "m²");
    if (panelItems.length > 0) groups.push({ title: "PANELES", items: panelItems });
  }

  const sections = [
    { key: "fijaciones", title: "FIJACIONES" },
    { key: "perfileria", title: "PERFILERÍA TECHO" },
    { key: "perfilesU", title: "PERFILES U" },
    { key: "esquineros", title: "ESQUINEROS" },
    { key: "perfilesExtra", title: "PERFILERÍA PARED" },
    { key: "selladores", title: "SELLADORES" },
    { key: "sellador", title: "SELLADORES" },
  ];

  const extractSections = (src, suffix = "") => {
    sections.forEach(({ key, title }) => {
      if (src[key] && src[key].items && src[key].items.length > 0) {
        const existingGroup = groups.find(g => g.title === title + suffix);
        if (existingGroup) {
          existingGroup.items.push(...src[key].items);
        } else {
          groups.push({ title: title + suffix, items: [...src[key].items] });
        }
      }
    });
  };

  extractSections(result);
  if (result.paredResult) extractSections(result.paredResult);
  if (result.techoResult) extractSections(result.techoResult);

  return groups;
}

// ── PDF / print utilities ────────────────────────────────────────────────────

export const fmtPrice = n => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generatePrintHTML(data) {
  const { client, project, scenario, panel, autoportancia, groups, totals, warnings, dimensions, descarte, listaPrecios } = data;
  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const scenarioLabel = { solo_techo: "Techo", solo_fachada: "Fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica" }[scenario] || scenario;
  const autoportStr = autoportancia?.ok === true ? `Autoportante ✓ · Apoyos: ${autoportancia.apoyos}` : autoportancia?.ok === false ? "⚠ Requiere estructura adicional" : "";
  const panelStr = panel.espesor ? `${panel.label} · ${panel.espesor}mm · Color: ${esc(panel.color)}` : esc(panel.label);

  // Dimensions section
  let dimSection = "";
  if (dimensions) {
    const dimItems = [];
    if (dimensions.zonas?.length) {
      if (dimensions.zonas.length === 1) {
        dimItems.push(`${dimensions.zonas[0].largo}m × ${dimensions.zonas[0].ancho}m`);
      } else {
        const zonasStr = dimensions.zonas.map((z, i) => `Zona ${i + 1}: ${z.largo}×${z.ancho}m`).join(", ");
        dimItems.push(zonasStr);
      }
    }
    if (dimensions.alto) dimItems.push(`Alto: ${dimensions.alto}m`);
    if (dimensions.perimetro) dimItems.push(`Perímetro: ${dimensions.perimetro}m`);
    if (dimensions.area) dimItems.push(`Área: ${dimensions.area}m²`);
    if (dimensions.cantPaneles) dimItems.push(`Paneles: ${dimensions.cantPaneles} pzas`);
    if (dimItems.length > 0) {
      dimSection = `<div style="background:#E8F4FD;padding:6px 10px;border-radius:4px;margin-bottom:6px;font-size:9pt"><b>DIMENSIONES:</b> ${dimItems.join(" · ")}</div>`;
    }
  }

  // Descarte section
  let descarteSection = "";
  if (descarte && descarte.anchoM > 0) {
    const largoRef = dimensions?.zonas?.[0]?.largo || "—";
    descarteSection = `<div style="background:#FFF3CD;padding:6px 10px;border-radius:4px;margin-bottom:6px;font-size:9pt;color:#856404"><b>DESCARTE:</b> ${descarte.anchoM}m × ${largoRef}m = ${descarte.areaM2}m² (${descarte.porcentaje}%)</div>`;
  }

  let tableBody = "";
  groups.forEach(g => {
    const sub = g.items.reduce((s, i) => s + (i.total || 0), 0);
    tableBody += `<tr style="background:#F0F4F8"><td colspan="5" style="font-weight:600;padding:4px 6px">▸ ${esc(g.title)}</td><td style="text-align:right;font-weight:600;padding:4px 6px">$${fmtPrice(sub)}</td></tr>`;
    g.items.forEach((item, idx) => {
      tableBody += `<tr style="background:${idx % 2 ? "#FAFAFA" : "#fff"}"><td style="padding:3px 6px">${esc(item.label)}</td><td style="text-align:center;color:#555;padding:3px 6px">${esc(item.sku || "—")}</td><td style="text-align:right;padding:3px 6px">${typeof item.cant === "number" ? (item.cant % 1 === 0 ? item.cant : item.cant.toFixed(2)) : item.cant}</td><td style="text-align:center;padding:3px 6px">${esc(item.unidad)}</td><td style="text-align:right;padding:3px 6px">${fmtPrice(item.pu)}</td><td style="text-align:right;padding:3px 6px">$${fmtPrice(item.total)}</td></tr>`;
    });
  });
  const warnHTML = (warnings || []).map(w => `<li style="color:#FF9500;font-weight:700">⚠ ${esc(w)}</li>`).join("");

  // Lista precios info
  const listaInfo = listaPrecios === "venta" ? "Lista: BMC Directo" : "Lista: Web";

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Cotización BMC Uruguay</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;font-size:10pt;color:#1D1D1F;margin:0;-webkit-print-color-adjust:exact}table{border-collapse:collapse;width:100%}th,td{border:0.4pt solid #D0D0D0}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px"><div style="font-size:18pt;font-weight:800;color:#003366">BMC Uruguay</div><div style="font-size:18pt;font-weight:800">COTIZACIÓN</div></div>
<div style="border-bottom:2pt solid #000;margin-bottom:4px"></div>
<div style="font-size:9pt;color:#444;margin-bottom:8px">bmcuruguay.com.uy · 092 663 245 · Maldonado, Uruguay · ${listaInfo}</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:10pt;margin-bottom:8px">
<div><b>Cliente:</b> ${esc(client.nombre)}</div><div><b>Fecha:</b> ${esc(project.fecha)}</div>
<div><b>RUT:</b> ${esc(client.rut)}</div><div><b>Ref:</b> ${esc(project.refInterna)}</div>
<div><b>Obra:</b> ${esc(project.descripcion)}</div><div><b>Validez:</b> 10 días</div>
<div><b>Tel:</b> ${esc(client.telefono)}</div><div><b>Dir:</b> ${esc(client.direccion)}</div>
</div>
<div style="background:#F0F4F8;padding:6px 10px;border-radius:4px;margin-bottom:6px"><b style="color:#003366">PRODUCTO:</b> ${panelStr} <span style="background:#003366;color:#fff;font-size:7.5pt;font-weight:700;padding:1px 6px;border-radius:3px;margin-left:8px">${esc(scenarioLabel)}</span>${autoportStr ? `<div style="font-size:8.5pt;color:#444;margin-top:2px">${autoportStr}</div>` : ""}</div>
${dimSection}
${descarteSection}
<table style="font-size:9pt;margin-bottom:6px"><thead><tr style="background:#EDEDED;font-weight:700"><th style="text-align:left;width:38%;padding:3px 6px">Descripción</th><th style="text-align:center;width:10%;padding:3px 6px">SKU</th><th style="text-align:right;width:8%;padding:3px 6px">Cant.</th><th style="text-align:center;width:7%;padding:3px 6px">Unid.</th><th style="text-align:right;width:13%;padding:3px 6px">P.U. USD</th><th style="text-align:right;width:14%;padding:3px 6px">Total USD</th></tr></thead><tbody>${tableBody}</tbody></table>
<div style="display:flex;justify-content:flex-end;margin-bottom:6px"><table style="min-width:260px;font-size:10pt"><tr><td style="padding:2px 8px">Subtotal s/IVA</td><td style="text-align:right;padding:2px 8px">$${fmtPrice(totals.subtotalSinIVA)}</td></tr><tr><td style="padding:2px 8px">IVA 22%</td><td style="text-align:right;padding:2px 8px">$${fmtPrice(totals.iva)}</td></tr><tr style="border-top:1pt solid #000;font-size:14pt;font-weight:800"><td style="padding:2px 8px">TOTAL USD</td><td style="text-align:right;color:#003366;padding:2px 8px">$${fmtPrice(totals.totalFinal)}</td></tr></table></div>
<div style="font-size:8pt;line-height:1.4;margin-bottom:6px"><b>COMENTARIOS:</b><ul style="margin:0;padding-left:14px"><li style="font-weight:700">Entrega 10 a 15 días.</li><li style="color:#FF3B30;font-weight:600">Oferta válida 10 días.</li><li style="font-weight:700;color:#FF3B30">Seña 60%, saldo contra entrega.</li><li>Precios en USD, IVA incluido en total.</li>${warnHTML}</ul></div>
<table style="font-size:8.5pt;margin-top:6px"><thead><tr><th colspan="2" style="background:#EDEDED;font-weight:700;text-align:left;padding:3px 8px">Depósito Bancario</th></tr></thead><tbody><tr><td style="padding:3px 8px">Titular: <b>Metalog SAS</b></td><td style="padding:3px 8px">RUT: 120403630012</td></tr><tr><td style="padding:3px 8px">BROU · Cta. Dólares: <b>110520638-00002</b></td><td style="padding:3px 8px">Consultas: <b>092 663 245</b></td></tr></tbody></table>
</body></html>`;
}

export function openPrintWindow(html) {
  const w = window.open("", "_blank", "width=800,height=1100");
  if (!w) { alert("Habilitá popups para imprimir."); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

export function generateInternalHTML(data) {
  const {
    client, project, scenario, panel, groups, totals, warnings,
    dimensions, descarte, listaPrecios, autoportancia,
    excludedItems, categoriasDesactivadas, formulas
  } = data;
  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const scenarioLabel = { solo_techo: "Techo", solo_fachada: "Fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica" }[scenario] || scenario;
  const timestamp = new Date().toLocaleString("es-UY");

  let inputsHTML = `<h3 style="margin:10px 0 5px;color:#003366">📥 INPUTS DEL USUARIO</h3><ul style="font-size:10pt;margin:0;padding-left:20px">`;
  inputsHTML += `<li>Escenario: ${esc(scenarioLabel)}</li>`;
  inputsHTML += `<li>Lista precios: ${listaPrecios === "venta" ? "BMC Directo" : "Web"}</li>`;
  inputsHTML += `<li>Panel: ${esc(panel.label)} ${panel.espesor || ""}mm · Color: ${esc(panel.color || "—")}</li>`;
  if (dimensions) {
    if (dimensions.zonas?.length) {
      dimensions.zonas.forEach((z, i) => {
        inputsHTML += `<li>Zona ${i + 1}: ${z.largo}m × ${z.ancho}m = ${(z.largo * z.ancho).toFixed(2)}m²</li>`;
      });
    }
    if (dimensions.alto) inputsHTML += `<li>Alto: ${dimensions.alto}m</li>`;
    if (dimensions.perimetro) inputsHTML += `<li>Perímetro: ${dimensions.perimetro}m</li>`;
  }
  inputsHTML += `</ul>`;

  let formulasHTML = "";
  if (formulas && formulas.length > 0) {
    formulasHTML = `<h3 style="margin:10px 0 5px;color:#003366">📐 FÓRMULAS APLICADAS</h3><ul style="font-size:9pt;margin:0;padding-left:20px;font-family:monospace">`;
    formulas.forEach(f => { formulasHTML += `<li>${esc(f)}</li>`; });
    formulasHTML += `</ul>`;
  }

  let excludedHTML = "";
  if (excludedItems && Object.keys(excludedItems).length > 0) {
    excludedHTML = `<h3 style="margin:10px 0 5px;color:#C0392B">🚫 ITEMS EXCLUIDOS</h3><ul style="font-size:10pt;margin:0;padding-left:20px">`;
    Object.entries(excludedItems).forEach(([id, label]) => { excludedHTML += `<li>${esc(label)} (${esc(id)})</li>`; });
    excludedHTML += `</ul>`;
  }

  let categoriasHTML = "";
  if (categoriasDesactivadas && categoriasDesactivadas.length > 0) {
    categoriasHTML = `<h3 style="margin:10px 0 5px;color:#FF9500">📦 CATEGORÍAS DESACTIVADAS</h3><ul style="font-size:10pt;margin:0;padding-left:20px">`;
    categoriasDesactivadas.forEach(c => { categoriasHTML += `<li>${esc(c)}</li>`; });
    categoriasHTML += `</ul>`;
  }

  let tableBody = "";
  groups.forEach(g => {
    const sub = g.items.reduce((s, i) => s + (i.total || 0), 0);
    tableBody += `<tr style="background:#E8F4FD"><td colspan="6" style="font-weight:600;padding:4px 6px">${esc(g.title)}</td><td style="text-align:right;font-weight:600;padding:4px 6px">$${fmtPrice(sub)}</td></tr>`;
    g.items.forEach((item, idx) => {
      const overrideNote = item.isOverridden ? ' (MODIFICADO)' : '';
      tableBody += `<tr style="background:${item.isOverridden ? "#FFF3CD" : idx % 2 ? "#FAFAFA" : "#fff"}"><td style="padding:3px 6px">${esc(item.label)}${overrideNote}</td><td style="text-align:center;color:#555;padding:3px 6px">${esc(item.sku || "—")}</td><td style="text-align:center;color:#888;padding:3px 6px;font-size:8pt">${esc(item.tipo || "—")}</td><td style="text-align:right;padding:3px 6px">${typeof item.cant === "number" ? item.cant.toFixed(2) : item.cant}</td><td style="text-align:center;padding:3px 6px">${esc(item.unidad)}</td><td style="text-align:right;padding:3px 6px">${fmtPrice(item.pu)}</td><td style="text-align:right;padding:3px 6px">$${fmtPrice(item.total)}</td></tr>`;
    });
  });

  const warnHTML = (warnings || []).map(w => `<li style="color:#FF9500">⚠ ${esc(w)}</li>`).join("");

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Informe Interno BMC</title><style>@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;font-size:10pt;color:#1D1D1F;margin:0;-webkit-print-color-adjust:exact}table{border-collapse:collapse;width:100%}th,td{border:0.4pt solid #D0D0D0}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px"><div style="font-size:16pt;font-weight:800;color:#003366">INFORME INTERNO — BMC Uruguay</div><div style="font-size:10pt;color:#666">${timestamp}</div></div>
<div style="border-bottom:2pt solid #003366;margin-bottom:8px"></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:10pt;margin-bottom:8px;background:#F8F8F8;padding:8px;border-radius:4px">
<div><b>Cliente:</b> ${esc(client.nombre)}</div><div><b>Fecha:</b> ${esc(project.fecha)}</div>
<div><b>RUT:</b> ${esc(client.rut)}</div><div><b>Ref:</b> ${esc(project.refInterna)}</div>
<div><b>Obra:</b> ${esc(project.descripcion)}</div><div><b>Dir:</b> ${esc(client.direccion)}</div>
</div>
${inputsHTML}
${formulasHTML}
${descarte && descarte.anchoM > 0 ? `<div style="background:#FFF3CD;padding:6px 10px;border-radius:4px;margin:8px 0;font-size:9pt;color:#856404"><b>DESCARTE:</b> ${descarte.anchoM}m × ${dimensions?.largo || "—"}m = ${descarte.areaM2}m² (${descarte.porcentaje}%)</div>` : ""}
${autoportancia ? `<div style="background:${autoportancia.ok ? "#D4EDDA" : "#F8D7DA"};padding:6px 10px;border-radius:4px;margin:8px 0;font-size:9pt"><b>AUTOPORTANCIA:</b> ${autoportancia.ok ? "OK" : "EXCEDE"} · Vano máx: ${autoportancia.maxSpan}m · Apoyos: ${autoportancia.apoyos}</div>` : ""}
${excludedHTML}
${categoriasHTML}
<h3 style="margin:10px 0 5px;color:#003366">📋 BOM DETALLADO</h3>
<table style="font-size:9pt;margin-bottom:6px"><thead><tr style="background:#EDEDED;font-weight:700"><th style="text-align:left;width:30%;padding:3px 6px">Descripción</th><th style="text-align:center;width:10%;padding:3px 6px">SKU</th><th style="text-align:center;width:10%;padding:3px 6px">Tipo</th><th style="text-align:right;width:10%;padding:3px 6px">Cant.</th><th style="text-align:center;width:8%;padding:3px 6px">Unid.</th><th style="text-align:right;width:12%;padding:3px 6px">P.U.</th><th style="text-align:right;width:12%;padding:3px 6px">Total</th></tr></thead><tbody>${tableBody}</tbody></table>
<div style="display:flex;justify-content:flex-end;margin:10px 0"><table style="min-width:220px;font-size:10pt"><tr><td style="padding:2px 8px">Subtotal s/IVA</td><td style="text-align:right;padding:2px 8px">$${fmtPrice(totals.subtotalSinIVA)}</td></tr><tr><td style="padding:2px 8px">IVA 22%</td><td style="text-align:right;padding:2px 8px">$${fmtPrice(totals.iva)}</td></tr><tr style="border-top:1pt solid #000;font-size:12pt;font-weight:800"><td style="padding:2px 8px">TOTAL USD</td><td style="text-align:right;color:#003366;padding:2px 8px">$${fmtPrice(totals.totalFinal)}</td></tr></table></div>
${warnHTML ? `<h3 style="margin:10px 0 5px;color:#FF9500">⚠ ADVERTENCIAS</h3><ul style="font-size:9pt;margin:0;padding-left:20px">${warnHTML}</ul>` : ""}
<div style="margin-top:12px;padding:8px;background:#F0F0F0;border-radius:4px;font-size:8pt;color:#666">
<b>Origen datos:</b> src/data/constants.js · Lista: ${listaPrecios === "venta" ? "BMC Directo (venta)" : "Web"}<br>
<b>Generado:</b> ${timestamp} · Calculadora BMC v3.0
</div>
</body></html>`;
}

export function buildWhatsAppText(data) {
  const { client, project, scenario, panel, totals, listaLabel } = data;
  const scenarioLabel = { solo_techo: "Solo techo", solo_fachada: "Solo fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica" }[scenario] || scenario;
  const panelStr = panel.espesor ? `${panel.label} ${panel.espesor}mm · Color: ${panel.color}` : panel.label;
  let txt = `*Cotización BMC Uruguay*\n📅 ${project.fecha} · Ref: ${project.refInterna || "—"}\n🏗 Cliente: ${client.nombre}${client.rut ? " · " + client.rut : ""}\n📐 Obra: ${project.descripcion || "—"} · ${client.direccion || "—"}\n💲 Lista: ${listaLabel}\n\n*Escenario:* ${scenarioLabel}\n*Panel:* ${panelStr}\n`;
  txt += `\n💰 *Subtotal s/IVA:* USD ${fmtPrice(totals.subtotalSinIVA)}\n💰 *IVA 22%:* USD ${fmtPrice(totals.iva)}\n✅ *TOTAL USD: ${fmtPrice(totals.totalFinal)}*\n\n_Entrega 10-15d · Seña 60%_\n_092 663 245 · bmcuruguay.com.uy_`;
  return txt;
}
