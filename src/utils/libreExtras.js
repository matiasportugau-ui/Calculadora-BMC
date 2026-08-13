// Extraordinarios: title/description lines + local reuse store.

export const CUSTOM_PRODUCTS_STORAGE_KEY = "bmc_custom_products_v1";

export const emptyExtraDraft = () => ({
  titulo: "",
  descripcion: "",
  precio: "",
  unidades: "",
  cantidad: "",
});

export function newExtraId() {
  return `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalize one extra line from form, stored row, or legacy { texto }.
 */
export function normalizeLibreExtra(raw) {
  if (!raw || typeof raw !== "object") return null;
  const titulo = String(raw.titulo ?? raw.label ?? raw.title ?? raw.texto ?? "").trim();
  const descripcion = String(raw.descripcion ?? raw.description ?? raw.detalle ?? "").trim();
  const unidades = String(raw.unidades ?? raw.unidad ?? raw.unit ?? "").trim();
  const precioSrc = raw.precio ?? raw.pu ?? raw.price ?? raw.precioUsd;
  const cantSrc = raw.cantidad ?? raw.cant ?? raw.qty ?? raw.quantity;
  const precio = precioSrc == null ? "" : String(precioSrc);
  const cantidad = cantSrc == null ? "" : String(cantSrc);
  const hasAny = titulo || descripcion || unidades || String(precio).trim() || String(cantidad).trim();
  if (!hasAny) return null;
  return {
    id: raw.id || newExtraId(),
    titulo,
    descripcion,
    precio,
    unidades,
    cantidad,
  };
}

/** Legacy single object and/or array → array of extras. */
export function hydrateLibreExtras(state) {
  if (Array.isArray(state?.libreExtras) && state.libreExtras.length) {
    return state.libreExtras.map(normalizeLibreExtra).filter(Boolean);
  }
  const extras = Array.isArray(state?.extras) ? state.extras.map(normalizeLibreExtra).filter(Boolean) : [];
  if (extras.length) return extras;
  const one = normalizeLibreExtra(state?.libreExtra || state?.extra);
  return one ? [one] : [];
}

export function extraToEngineItem(ex) {
  const n = normalizeLibreExtra(ex);
  if (!n) return null;
  const precioRaw = n.precio === "" ? NaN : parseFloat(String(n.precio).replace(",", "."));
  const cantRaw = n.cantidad === "" ? NaN : parseFloat(String(n.cantidad).replace(",", "."));
  const hasPrecio = !Number.isNaN(precioRaw) && precioRaw >= 0;
  const hasCant = !Number.isNaN(cantRaw) && cantRaw > 0;
  // BOM / PDF / WA only render `label` — fold description in so it is not silently dropped.
  const note = n.titulo && n.descripcion ? n.descripcion : "";
  const label = note
    ? `${n.titulo} — ${n.descripcion}`
    : (n.titulo || n.descripcion || "Partida extraordinaria");
  const puE = hasPrecio ? precioRaw : 0;
  const cE = hasCant ? cantRaw : 1;
  return {
    label,
    note,
    sku: "EXTRA",
    cant: cE,
    unidad: n.unidades || "unid",
    pu: puE,
    total: +(cE * puE).toFixed(2),
  };
}

export function extrasToEngineItems(list) {
  return (Array.isArray(list) ? list : []).map(extraToEngineItem).filter(Boolean);
}

export function loadSavedCustomProducts() {
  try {
    const raw = localStorage.getItem(CUSTOM_PRODUCTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeLibreExtra).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveCustomProductLocal(item) {
  const n = normalizeLibreExtra(item);
  if (!n || !n.titulo) return loadSavedCustomProducts();
  const prev = loadSavedCustomProducts();
  const key = n.titulo.toLowerCase();
  const next = [
    { ...n, id: n.id || newExtraId() },
    ...prev.filter((p) => (p.titulo || "").toLowerCase() !== key),
  ].slice(0, 40);
  try {
    localStorage.setItem(CUSTOM_PRODUCTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export async function notifyCustomProduct(payload) {
  const base =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE
      ? String(import.meta.env.VITE_API_BASE).replace(/\/+$/, "")
      : "";
  try {
    await fetch(`${base}/api/catalog/custom-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload || {}),
    });
  } catch {
    /* fail-open */
  }
}
