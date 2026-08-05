/**
 * Quote → Ops handoff payload (BMC Envíos U2).
 * Pure functions only — no React. sessionStorage key for browser bridge.
 */

export const BRIDGE_SCHEMA_VERSION = 1;
export const BRIDGE_STORAGE_KEY = "bmc-envios-bridge-v1";

/**
 * @typedef {{ tipo: string, espesor: number, longitud: number, cantidad: number, id?: string }} BridgePanel
 * @typedef {{
 *   schemaVersion: number,
 *   source: string,
 *   createdAt: string,
 *   destino: string,
 *   zona?: string,
 *   quote?: object,
 *   panels: BridgePanel[],
 *   proyectoRef?: { cliente?: string|null, direccion?: string|null }
 * }} BridgePayload
 */

/**
 * Build versioned handoff payload from quote state.
 * @param {object} input
 * @param {BridgePanel[]} input.panels
 * @param {string} [input.destino]
 * @param {object} [input.quote] summary from quoteFreight
 * @param {object} [input.proyectoRef]
 * @returns {BridgePayload}
 */
export function buildBridgePayload(input = {}) {
  const panels = Array.isArray(input.panels)
    ? input.panels.map((p, i) => ({
        id: p.id || `bp-${i}`,
        tipo: String(p.tipo || "PANEL"),
        espesor: Math.round(Number(p.espesor) || 0),
        longitud: Math.max(0, Number(p.longitud) || 0),
        cantidad: Math.max(0, Math.floor(Number(p.cantidad) || 0)),
      }))
    : [];
  return {
    schemaVersion: BRIDGE_SCHEMA_VERSION,
    source: input.source || "wizard_flete",
    createdAt: input.createdAt || new Date().toISOString(),
    destino: String(input.destino || "").trim(),
    zona: input.zona != null ? String(input.zona) : input.quote?.summary?.zona || input.quote?.zona,
    quote: input.quote
      ? {
          ok: input.quote.ok,
          mode: input.quote.mode,
          ventaUsd: input.quote.ventaUsd,
          costoUsd: input.quote.costoUsd,
          summary: input.quote.summary || null,
        }
      : null,
    panels,
    proyectoRef: {
      cliente: input.proyectoRef?.cliente ?? null,
      direccion: input.proyectoRef?.direccion ?? input.destino ?? null,
    },
  };
}

/**
 * Validate and normalize a raw payload (object or JSON string).
 * @param {unknown} raw
 * @returns {{ ok: true, payload: BridgePayload } | { ok: false, error: string }}
 */
export function parseBridgePayload(raw) {
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { ok: false, error: "invalid_json" };
    }
  }
  if (!obj || typeof obj !== "object") return { ok: false, error: "not_object" };
  const schemaVersion = Number(obj.schemaVersion);
  if (schemaVersion !== BRIDGE_SCHEMA_VERSION) {
    return { ok: false, error: `unsupported_schema_${obj.schemaVersion}` };
  }
  if (!Array.isArray(obj.panels)) return { ok: false, error: "panels_required" };
  const payload = buildBridgePayload(obj);
  return { ok: true, payload };
}

/**
 * Append bridge-derived stops onto an existing ops draft.
 * Never replaces prior paradas — quote→ops handoff must not wipe localStorage drafts.
 *
 * @param {object[]} existingStops
 * @param {object[]} bridgeStops from bridgePayloadToStops().stops
 * @param {{ colors?: string[] }} [opts]
 * @returns {object[]}
 */
export function mergeBridgeStopsIntoDraft(existingStops = [], bridgeStops = [], opts = {}) {
  const colors = Array.isArray(opts.colors) && opts.colors.length ? opts.colors : ["#0071e3"];
  const base = Array.isArray(existingStops) ? existingStops : [];
  const incoming = Array.isArray(bridgeStops) ? bridgeStops : [];
  if (!incoming.length) return base;
  const start = base.length;
  return [
    ...base,
    ...incoming.map((stop, i) => ({
      ...stop,
      orden: start + i + 1,
      // Recolor by draft index so appends stay on the ops palette (bridge default is ignored).
      color: colors[(start + i) % colors.length],
    })),
  ];
}

/**
 * Convert bridge payload into a minimal stop list for /logistica.
 * @param {BridgePayload} payload
 * @param {{ uid?: () => string, color?: string }} [opts]
 * @returns {{ stops: object[], infoPatch: object }}
 */
export function bridgePayloadToStops(payload, opts = {}) {
  let n = 0;
  const uid = opts.uid || (() => `br-${++n}`);
  const panels = (payload.panels || [])
    .filter((p) => p.cantidad > 0 && p.longitud > 0)
    .map((p) => ({
      id: p.id || uid(),
      tipo: p.tipo,
      espesor: p.espesor,
      longitud: p.longitud,
      cantidad: p.cantidad,
    }));
  const stop = {
    id: uid(),
    orden: 1,
    cliente: payload.proyectoRef?.cliente || "",
    telefono: "",
    direccion: payload.destino || payload.proyectoRef?.direccion || "",
    zona: payload.zona || "",
    color: opts.color || "#0071e3",
    paneles: panels,
    accesorios: [],
    estado: "Pendiente",
    notes: payload.quote?.summary?.label || "",
  };
  const infoPatch = {
    notas: payload.quote?.summary?.label
      ? `Import cotización: ${payload.quote.summary.label}`
      : "Import desde Cotizar flete",
  };
  if (payload.quote?.ventaUsd != null) {
    infoPatch.notas += ` · venta USD ${payload.quote.ventaUsd}`;
  }
  return { stops: panels.length ? [stop] : [], infoPatch };
}

/**
 * Persist payload in sessionStorage (browser only).
 * @param {BridgePayload} payload
 * @param {Storage} [store]
 */
export function saveBridgePayload(payload, store) {
  const s = store || (typeof sessionStorage !== "undefined" ? sessionStorage : null);
  if (!s) return false;
  try {
    s.setItem(BRIDGE_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Load and optionally clear bridge payload from sessionStorage.
 * @param {{ clear?: boolean, store?: Storage }} [opts]
 * @returns {BridgePayload|null}
 */
export function loadBridgePayload(opts = {}) {
  const s = opts.store || (typeof sessionStorage !== "undefined" ? sessionStorage : null);
  if (!s) return null;
  try {
    const raw = s.getItem(BRIDGE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = parseBridgePayload(raw);
    if (opts.clear !== false) s.removeItem(BRIDGE_STORAGE_KEY);
    return parsed.ok ? parsed.payload : null;
  } catch {
    return null;
  }
}
