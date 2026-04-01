// ═══════════════════════════════════════════════════════════════════════════
// pricing.js — Datos de precios con overrides aplicados
// La calculadora usa getPricing() en lugar de constants directo
// ═══════════════════════════════════════════════════════════════════════════

import {
  PANELS_TECHO as PT,
  PANELS_PARED as PP,
  FIJACIONES as F,
  SELLADORES as S,
  PERFIL_TECHO as PET,
  PERFIL_PARED as PEP,
  SERVICIOS as SRV,
  HERRAMIENTAS as H,
} from "./constants.js";
import { getPricingOverrides, applyOverridesToObject } from "../utils/pricingOverrides.js";
import { getDimensioningOverrides } from "../utils/dimensioningFormulasOverrides.js";

const BASE = {
  PANELS_TECHO: PT,
  PANELS_PARED: PP,
  FIJACIONES: F,
  SELLADORES: S,
  PERFIL_TECHO: PET,
  PERFIL_PARED: PEP,
  SERVICIOS: SRV,
  HERRAMIENTAS: H,
};

let _cache = null;

/** Obtener pricing con overrides aplicados. Cache se invalida al guardar overrides. */
export function getPricing() {
  if (_cache) return _cache;
  const pricingOverrides = getPricingOverrides();
  const dimensioningOverrides = getDimensioningOverrides();
  const allOverrides = { ...pricingOverrides, ...dimensioningOverrides };
  _cache = applyOverridesToObject(BASE, allOverrides);
  return _cache;
}

/** Invalidar cache (llamar tras guardar overrides) */
export function invalidatePricingCache() {
  _cache = null;
}

/** Lista plana de ítems editables para la UI */
export function getPricingItemsFlat() {
  const pricing = getPricing();
  const items = [];

  // Paneles techo
  for (const [famId, panel] of Object.entries(pricing.PANELS_TECHO || {})) {
    if (!panel.esp) continue;
    for (const [esp, data] of Object.entries(panel.esp)) {
      if (data.venta != null) items.push({ path: `PANELS_TECHO.${famId}.esp.${esp}`, label: `${panel.label} ${esp}mm`, venta: data.venta, ventaIvaInc: data.ventaIvaInc, web: data.web, webIvaInc: data.webIvaInc, costo: data.costo, unidad: "m²", categoria: "Paneles Techo" });
    }
  }

  // Paneles pared
  for (const [famId, panel] of Object.entries(pricing.PANELS_PARED || {})) {
    if (!panel.esp) continue;
    for (const [esp, data] of Object.entries(panel.esp)) {
      if (data.venta != null) items.push({ path: `PANELS_PARED.${famId}.esp.${esp}`, label: `${panel.label} ${esp}mm`, venta: data.venta, ventaIvaInc: data.ventaIvaInc, web: data.web, webIvaInc: data.webIvaInc, costo: data.costo, unidad: "m²", categoria: "Paneles Pared" });
    }
  }

  // Fijaciones
  for (const [id, data] of Object.entries(pricing.FIJACIONES || {})) {
    if (data.venta != null) items.push({ path: `FIJACIONES.${id}`, label: data.label, venta: data.venta, ventaIvaInc: data.ventaIvaInc, web: data.web, webIvaInc: data.webIvaInc, costo: data.costo, unidad: data.unidad || "unid", categoria: "Fijaciones" });
  }

  // Selladores
  for (const [id, data] of Object.entries(pricing.SELLADORES || {})) {
    if (data.venta != null) items.push({ path: `SELLADORES.${id}`, label: data.label, venta: data.venta, ventaIvaInc: data.ventaIvaInc, web: data.web, webIvaInc: data.webIvaInc, costo: data.costo, unidad: data.unidad || "unid", categoria: "Selladores" });
  }

  // Perfil techo (anidado)
  for (const [tipo, byFam] of Object.entries(pricing.PERFIL_TECHO || {})) {
    for (const [fam, byEsp] of Object.entries(byFam)) {
      if (byEsp._all) {
        const d = byEsp._all;
        items.push({ path: `PERFIL_TECHO.${tipo}.${fam}._all`, label: `${tipo} (${fam})`, venta: d.venta, ventaIvaInc: d.ventaIvaInc, web: d.web, webIvaInc: d.webIvaInc, costo: d.costo, sku: d.sku, unidad: "unid", categoria: "Perfilería Techo" });
      } else {
        for (const [esp, d] of Object.entries(byEsp)) {
          if (d && typeof d === "object" && (d.venta != null || d.web != null))
            items.push({ path: `PERFIL_TECHO.${tipo}.${fam}.${esp}`, label: `${tipo} ${fam} ${esp}mm`, venta: d.venta, ventaIvaInc: d.ventaIvaInc, web: d.web, webIvaInc: d.webIvaInc, costo: d.costo, sku: d.sku, unidad: "unid", categoria: "Perfilería Techo" });
        }
      }
    }
  }

  // Perfil pared
  for (const [tipo, byFam] of Object.entries(pricing.PERFIL_PARED || {})) {
    for (const [fam, byEsp] of Object.entries(byFam)) {
      if (fam === "_all" && byEsp && (byEsp.venta != null || byEsp.web != null)) {
        items.push({ path: `PERFIL_PARED.${tipo}._all`, label: byEsp.label || tipo, venta: byEsp.venta, ventaIvaInc: byEsp.ventaIvaInc, web: byEsp.web, webIvaInc: byEsp.webIvaInc, costo: byEsp.costo, sku: byEsp.sku, unidad: "unid", categoria: "Perfilería Pared" });
      } else if (byEsp._all) {
        const d = byEsp._all;
        items.push({ path: `PERFIL_PARED.${tipo}.${fam}._all`, label: d.label || `${tipo} (${fam})`, venta: d.venta, ventaIvaInc: d.ventaIvaInc, web: d.web, webIvaInc: d.webIvaInc, costo: d.costo, sku: d.sku, unidad: "unid", categoria: "Perfilería Pared" });
      } else {
        for (const [esp, d] of Object.entries(byEsp)) {
          if (esp !== "_all" && d && typeof d === "object" && (d.venta != null || d.web != null))
            items.push({ path: `PERFIL_PARED.${tipo}.${fam}.${esp}`, label: `${tipo} ${fam} ${esp}mm`, venta: d.venta, ventaIvaInc: d.ventaIvaInc, web: d.web, webIvaInc: d.webIvaInc, costo: d.costo, sku: d.sku, unidad: "unid", categoria: "Perfilería Pared" });
        }
      }
    }
  }

  // Servicios
  for (const [id, data] of Object.entries(pricing.SERVICIOS || {})) {
    if (data.venta != null) items.push({ path: `SERVICIOS.${id}`, label: data.label, venta: data.venta, ventaIvaInc: data.ventaIvaInc, web: data.web, webIvaInc: data.webIvaInc, costo: data.costo, unidad: data.unidad || "servicio", categoria: "Servicios" });
  }

  // Herramientas (presupuesto libre / MATRIZ)
  for (const [id, data] of Object.entries(pricing.HERRAMIENTAS || {})) {
    if (data.venta != null) items.push({ path: `HERRAMIENTAS.${id}`, label: data.label, venta: data.venta, ventaIvaInc: data.ventaIvaInc, web: data.web, webIvaInc: data.webIvaInc, costo: data.costo, unidad: data.unidad || "unid", categoria: "Herramientas" });
  }

  return items;
}

/** Obtener valor en un objeto por path (ej. "PANELS_TECHO.ISODEC_EPS.esp.100.web") */
export function getValueAtPath(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}
