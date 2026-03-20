// ═══════════════════════════════════════════════════════════════════════════
// pricingOverrides.js — Overrides de precios y costos (localStorage)
// Paths: "PANELS_TECHO.ISODEC_EPS.esp.100.web", "FIJACIONES.varilla_38.venta", etc.
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "bmc-pricing-overrides";

let _overrides = null;

function load() {
  if (_overrides) return _overrides;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _overrides = raw ? JSON.parse(raw) : {};
  } catch {
    _overrides = {};
  }
  return _overrides;
}

function save(overrides) {
  _overrides = { ...overrides };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_overrides));
  } catch (e) {
    console.warn("pricingOverrides: could not save", e);
  }
  return _overrides;
}

/** Obtener overrides actuales */
export function getPricingOverrides() {
  return { ...load() };
}

/** Setear un override por path */
export function setPricingOverride(path, value) {
  const next = { ...load() };
  if (value == null || value === "") {
    delete next[path];
  } else {
    next[path] = typeof value === "number" ? +(+value).toFixed(2) : value;
  }
  save(next);
  return next;
}

/** Setear múltiples overrides */
export function setPricingOverridesBulk(updates) {
  const next = { ...load() };
  for (const [path, value] of Object.entries(updates)) {
    if (value == null || value === "") delete next[path];
    else next[path] = typeof value === "number" ? +(+value).toFixed(2) : value;
  }
  save(next);
  return next;
}

/** Aplicar % a un campo en múltiples paths. Ej: applyBulkPercent(paths, "web", 10, getCurrentValue) = +10%
 * getCurrentValue(fullPath) debe retornar el valor actual (base o override) */
export function applyBulkPercent(paths, field, percent, getCurrentValue) {
  const next = { ...load() };
  const factor = 1 + percent / 100;
  for (const path of paths) {
    const fullPath = field ? `${path}.${field}` : path;
    const current = next[fullPath] ?? (getCurrentValue ? getCurrentValue(fullPath) : null);
    if (typeof current === "number") {
      next[fullPath] = +(current * factor).toFixed(2);
    }
  }
  save(next);
  return next;
}

/** Aplicar % a todos los items de una categoría (paths que empiezan con prefix) */
export function applyBulkPercentByPrefix(prefix, field, percent) {
  const overrides = load();
  const paths = Object.keys(overrides).filter((p) => p.startsWith(prefix) && (!field || p.endsWith(`.${field}`)));
  return applyBulkPercent(paths.map((p) => (field ? p.replace(`.${field}`, "") : p)), field, percent);
}

/** Restaurar overrides por defecto (vacío) */
export function resetPricingOverrides() {
  _overrides = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  return {};
}

/** Aplicar overrides a un objeto base (deep clone + set by path) */
export function applyOverridesToObject(base, overrides) {
  const clone = JSON.parse(JSON.stringify(base));
  for (const [path, value] of Object.entries(overrides)) {
    setByPath(clone, path, value);
  }
  return clone;
}

function setByPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];
    const isArrayIndex = /^\d+$/.test(nextKey);
    if (!(key in cur)) cur[key] = isArrayIndex ? [] : {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}
