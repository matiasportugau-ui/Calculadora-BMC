// Matriz de precios BC / Jenerik — almacén propio.
// No usa `bmc-pricing-overrides`, no llama /api/matriz/*, no escribe Sheets BMC.
// Semilla = copia de venta al primer uso. Después Jenerik es dueño de los números.

import {
  PANELS_TECHO,
  PANELS_PARED,
  FIJACIONES,
  SELLADORES,
  PERFIL_TECHO,
  PERFIL_PARED,
  LIMA_OLLA,
  SERVICIOS,
  HERRAMIENTAS,
  IVA_MULT,
} from "../data/constants.js";

import { WHITELABEL, WHITELABEL_BRAND } from "../config/whitelabel.js";
import { readScopedItem, removeScopedItem, tenantStorageKey, writeScopedItem } from "./tenantScope.js";

const MATRIZ_LEAF = "matriz-v1";
const MATRIZ_LEGACY = WHITELABEL ? `${WHITELABEL}-matriz-v1` : "bc-jenerik-matriz-v1";
export const JENERIK_MATRIZ_KEY = tenantStorageKey(MATRIZ_LEAF) || MATRIZ_LEGACY;

/** UI copy for the active tenant. Never names BMC or another tenant. */
export function tenantMatrizCopy() {
  const marca = WHITELABEL_BRAND?.marca || "tu marca";
  const slug = WHITELABEL || "tenant";
  return {
    tab: "Tu matriz",
    title: "Tu matriz personalizada",
    body: `Esta es la matriz de ${marca}. Solo esta app la usa. No se mezcla con otras marcas.`,
    download: "Descargar matriz",
    reset: "Restaurar semilla",
    resetConfirm: "¿Volver a los precios iniciales de tu matriz?",
    saved: "Precio guardado. La calculadora ya lo usa.",
    bulk: (n, count) => `Aplicado ${n}% a ${count} ítem(s) de tu matriz.`,
    resetDone: "Matriz restaurada a su semilla.",
    imported: (n) => `Importados ${n} precios en tu matriz.`,
    csvNeed: "El CSV necesita columnas path + venta.",
    filename: `matriz-${slug}-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}

const CATALOG = {
  PANELS_TECHO,
  PANELS_PARED,
  FIJACIONES,
  SELLADORES,
  PERFIL_TECHO,
  PERFIL_PARED,
  LIMA_OLLA,
  SERVICIOS,
  HERRAMIENTAS,
};

function emptyDoc() {
  return { v: 1, seededAt: null, seed: {}, live: {} };
}

function readStorage() {
  if (typeof localStorage === "undefined") return emptyDoc();
  try {
    const raw = readScopedItem(MATRIZ_LEAF, MATRIZ_LEGACY);
    if (!raw) return emptyDoc();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyDoc();
    return {
      v: 1,
      seededAt: parsed.seededAt || null,
      seed: parsed.seed && typeof parsed.seed === "object" ? parsed.seed : {},
      live: parsed.live && typeof parsed.live === "object" ? parsed.live : {},
    };
  } catch {
    return emptyDoc();
  }
}

function writeStorage(doc) {
  if (typeof localStorage === "undefined") return doc;
  try {
    writeScopedItem(MATRIZ_LEAF, JSON.stringify(doc), MATRIZ_LEGACY);
  } catch (e) {
    console.warn("jenerikMatriz: persist failed", e);
  }
  return doc;
}

/** Sale rows from baked constants only (never BMC overrides / MATRIZ). */
export function listJenerikSeedRows(catalog = CATALOG) {
  const items = [];
  const push = (path, label, data, unidad, categoria) => {
    if (!data || typeof data !== "object") return;
    const venta = data.venta != null ? Number(data.venta) : Number(data.web);
    if (!Number.isFinite(venta)) return;
    items.push({
      path,
      label,
      categoria,
      unidad: data.unidad || unidad,
      venta,
    });
  };

  for (const [famId, panel] of Object.entries(catalog.PANELS_TECHO || {})) {
    for (const [esp, data] of Object.entries(panel.esp || {})) {
      push(`PANELS_TECHO.${famId}.esp.${esp}`, `${panel.label} ${esp}mm`, data, "m²", "Paneles Techo");
    }
  }
  for (const [famId, panel] of Object.entries(catalog.PANELS_PARED || {})) {
    for (const [esp, data] of Object.entries(panel.esp || {})) {
      push(`PANELS_PARED.${famId}.esp.${esp}`, `${panel.label} ${esp}mm`, data, "m²", "Paneles Pared");
    }
  }
  for (const [id, data] of Object.entries(catalog.FIJACIONES || {})) {
    push(`FIJACIONES.${id}`, data.label, data, data.unidad || "unid", "Fijaciones");
  }
  for (const [id, data] of Object.entries(catalog.SELLADORES || {})) {
    push(`SELLADORES.${id}`, data.label, data, data.unidad || "unid", "Selladores");
  }
  for (const [tipo, byFam] of Object.entries(catalog.PERFIL_TECHO || {})) {
    for (const [fam, byEsp] of Object.entries(byFam || {})) {
      if (byEsp?._all) {
        push(`PERFIL_TECHO.${tipo}.${fam}._all`, `${tipo} (${fam})`, byEsp._all, "unid", "Perfilería Techo");
      } else {
        for (const [esp, d] of Object.entries(byEsp || {})) {
          push(`PERFIL_TECHO.${tipo}.${fam}.${esp}`, `${tipo} ${fam} ${esp}mm`, d, "unid", "Perfilería Techo");
        }
      }
    }
  }
  for (const [tipo, byFam] of Object.entries(catalog.PERFIL_PARED || {})) {
    for (const [fam, byEsp] of Object.entries(byFam || {})) {
      if (fam === "_all") {
        push(`PERFIL_PARED.${tipo}._all`, byEsp.label || tipo, byEsp, "unid", "Perfilería Pared");
      } else if (byEsp?._all) {
        push(`PERFIL_PARED.${tipo}.${fam}._all`, byEsp._all.label || `${tipo} (${fam})`, byEsp._all, "unid", "Perfilería Pared");
      } else {
        for (const [esp, d] of Object.entries(byEsp || {})) {
          if (esp === "_all") continue;
          push(`PERFIL_PARED.${tipo}.${fam}.${esp}`, `${tipo} ${fam} ${esp}mm`, d, "unid", "Perfilería Pared");
        }
      }
    }
  }
  for (const [id, data] of Object.entries(catalog.LIMA_OLLA || {})) {
    push(`LIMA_OLLA.${id}`, data.label, data, "unid", "Lima-olla");
  }
  for (const [id, data] of Object.entries(catalog.SERVICIOS || {})) {
    push(`SERVICIOS.${id}`, data.label, data, data.unidad || "servicio", "Servicios");
  }
  for (const [id, data] of Object.entries(catalog.HERRAMIENTAS || {})) {
    push(`HERRAMIENTAS.${id}`, data.label, data, data.unidad || "unid", "Herramientas");
  }
  return items;
}

function seedMapFromCatalog() {
  const seed = {};
  for (const row of listJenerikSeedRows()) seed[row.path] = row.venta;
  return seed;
}

function ensureSeeded() {
  const doc = readStorage();
  if (doc.seededAt && Object.keys(doc.seed).length) return doc;
  doc.seed = seedMapFromCatalog();
  doc.seededAt = new Date().toISOString();
  if (!doc.live) doc.live = {};
  return writeStorage(doc);
}

export function getJenerikDoc() {
  return ensureSeeded();
}

/** path → venta Jenerik (live pisa seed). */
export function getJenerikSaleMap() {
  const doc = ensureSeeded();
  return { ...doc.seed, ...doc.live };
}

/** Overrides for getPricing: venta+web, nunca costo. */
export function getJenerikPricingOverrides() {
  const map = getJenerikSaleMap();
  const out = {};
  for (const [path, venta] of Object.entries(map)) {
    const n = Number(venta);
    if (!Number.isFinite(n)) continue;
    out[`${path}.venta`] = n;
    out[`${path}.web`] = n;
    out[`${path}.ventaIvaInc`] = +(n * IVA_MULT).toFixed(2);
    out[`${path}.webIvaInc`] = +(n * IVA_MULT).toFixed(2);
  }
  return out;
}

export function setJenerikSale(path, venta) {
  const doc = ensureSeeded();
  if (venta == null || venta === "") {
    delete doc.live[path];
  } else {
    const n = +Number(venta).toFixed(2);
    if (!Number.isFinite(n) || n < 0) return getJenerikSaleMap();
    doc.live[path] = n;
  }
  writeStorage(doc);
  return getJenerikSaleMap();
}

export function setJenerikSalesBulk(updates) {
  const doc = ensureSeeded();
  for (const [path, venta] of Object.entries(updates || {})) {
    if (venta == null || venta === "") delete doc.live[path];
    else {
      const n = +Number(venta).toFixed(2);
      if (Number.isFinite(n) && n >= 0) doc.live[path] = n;
    }
  }
  writeStorage(doc);
  return getJenerikSaleMap();
}

export function applyJenerikBulkPercent(paths, percent) {
  const map = getJenerikSaleMap();
  const factor = 1 + Number(percent) / 100;
  const updates = {};
  for (const path of paths) {
    const cur = Number(map[path]);
    if (Number.isFinite(cur)) updates[path] = +(cur * factor).toFixed(2);
  }
  return setJenerikSalesBulk(updates);
}

/** Vuelve a la semilla BC (no a la MATRIZ BMC en vivo). */
export function resetJenerikMatrizToSeed() {
  const doc = ensureSeeded();
  doc.live = {};
  writeStorage(doc);
  return getJenerikSaleMap();
}

export function jenerikRowsForUi() {
  const map = getJenerikSaleMap();
  const seed = ensureSeeded().seed;
  return listJenerikSeedRows().map((row) => {
    const venta = map[row.path] ?? row.venta;
    return {
      ...row,
      venta,
      ventaIva: +(Number(venta) * IVA_MULT).toFixed(2),
      dirty: seed[row.path] !== venta,
    };
  });
}

export function exportJenerikCsv(rows = jenerikRowsForUi()) {
  const headers = ["path", "label", "categoria", "venta", "venta_iva", "unidad"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const cells = [
      r.path,
      r.label,
      r.categoria,
      r.venta != null ? String(r.venta) : "",
      r.ventaIva != null ? String(r.ventaIva) : "",
      r.unidad || "",
    ].map((c) => {
      const s = String(c ?? "");
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    });
    lines.push(cells.join(","));
  }
  return "\uFEFF" + lines.join("\n");
}

export function parseJenerikCsv(text) {
  const raw = String(text || "").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return {};
  const split = (line) => {
    const out = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') { cur += '"'; i++; }
        else q = !q;
      } else if (ch === "," && !q) {
        out.push(cur); cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const cols = split(lines[0]).map((c) => c.trim().toLowerCase());
  const pathIdx = cols.indexOf("path");
  let ventaIdx = cols.indexOf("venta_jenerik");
  if (ventaIdx < 0) ventaIdx = cols.indexOf("venta");
  if (pathIdx < 0 || ventaIdx < 0) return {};
  const updates = {};
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]);
    const path = (cells[pathIdx] || "").trim();
    const n = Number(String(cells[ventaIdx] || "").replace(",", "."));
    if (path && Number.isFinite(n)) updates[path] = n;
  }
  return updates;
}

/** Test helper */
export function __resetJenerikMatrizForTests() {
  removeScopedItem(MATRIZ_LEAF, MATRIZ_LEGACY);
}
