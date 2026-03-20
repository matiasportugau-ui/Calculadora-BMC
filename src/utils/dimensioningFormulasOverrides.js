// ═══════════════════════════════════════════════════════════════════════════
// dimensioningFormulasOverrides.js — Overrides de fórmulas de dimensionamiento
// Paths: "FIJACIONES_VARILLA.espaciado_perimetro", "PANELS_TECHO.ISODEC_EPS.au", etc.
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "bmc-dimensioning-overrides";
const STORAGE_KEY_FORMULAS = "bmc-dimensioning-formula-overrides";

let _overrides = null;
let _formulaOverrides = null;

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

function loadFormulas() {
  if (_formulaOverrides) return _formulaOverrides;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FORMULAS);
    _formulaOverrides = raw ? JSON.parse(raw) : {};
  } catch {
    _formulaOverrides = {};
  }
  return _formulaOverrides;
}

function save(overrides) {
  _overrides = { ...overrides };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_overrides));
  } catch (e) {
    console.warn("dimensioningFormulasOverrides: could not save", e);
  }
  return _overrides;
}

function saveFormulas(formulas) {
  _formulaOverrides = { ...formulas };
  try {
    localStorage.setItem(STORAGE_KEY_FORMULAS, JSON.stringify(_formulaOverrides));
  } catch (e) {
    console.warn("dimensioningFormulasOverrides: could not save formulas", e);
  }
  return _formulaOverrides;
}

/** Obtener overrides actuales */
export function getDimensioningOverrides() {
  return { ...load() };
}

/** Setear un override por path */
export function setDimensioningOverride(path, value) {
  const next = { ...load() };
  if (value == null || value === "" || (typeof value === "number" && isNaN(value))) {
    delete next[path];
  } else {
    next[path] = typeof value === "number" ? +(+value).toFixed(4) : value;
  }
  save(next);
  return next;
}

/** Setear múltiples overrides */
export function setDimensioningOverridesBulk(updates) {
  const next = { ...load() };
  for (const [path, value] of Object.entries(updates)) {
    if (value == null || value === "" || (typeof value === "number" && isNaN(value))) delete next[path];
    else next[path] = typeof value === "number" ? +(+value).toFixed(4) : value;
  }
  save(next);
  return next;
}

/** Obtener overrides de texto de fórmula (path → string) */
export function getDimensioningFormulaOverrides() {
  return { ...loadFormulas() };
}

/** Setear override de texto de fórmula por path */
export function setDimensioningFormulaOverride(path, formula) {
  const next = { ...loadFormulas() };
  if (formula == null || String(formula).trim() === "") {
    delete next[path];
  } else {
    next[path] = String(formula).trim();
  }
  saveFormulas(next);
  return next;
}

/** Setear múltiples overrides de fórmula (path → string) */
export function setDimensioningFormulaOverridesBulk(updates) {
  const next = { ...loadFormulas() };
  for (const [path, formula] of Object.entries(updates)) {
    if (formula == null || String(formula).trim() === "") delete next[path];
    else next[path] = String(formula).trim();
  }
  saveFormulas(next);
  return next;
}

/** Restaurar overrides por defecto (vacío) */
export function resetDimensioningOverrides() {
  _overrides = {};
  _formulaOverrides = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_FORMULAS);
  } catch { /* ignore */ }
  return {};
}
