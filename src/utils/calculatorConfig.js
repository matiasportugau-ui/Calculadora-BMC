// ═══════════════════════════════════════════════════════════════════════════
// calculatorConfig.js — Variables configurables de la calculadora
// Persiste en localStorage (bmc-calculator-config)
// ═══════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = "bmc-calculator-config";

const DEFAULTS = {
  iva: 0.22,
  listaDefault: "venta", // Precios BMC venta directa
  fleteDefault: 280,
};

let _config = null;

function load() {
  if (_config) return _config;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      _config = { ...DEFAULTS, ...parsed };
    } else {
      _config = { ...DEFAULTS };
    }
  } catch {
    _config = { ...DEFAULTS };
  }
  return _config;
}

function save(config) {
  _config = { ...DEFAULTS, ...config };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_config));
  } catch (e) {
    console.warn("calculatorConfig: could not save to localStorage", e);
  }
  return _config;
}

export function getConfig() {
  return { ...load() };
}

export function setConfig(updates) {
  const next = { ...load(), ...updates };
  save(next);
  return next;
}

export function getIVA() {
  return load().iva ?? DEFAULTS.iva;
}

export function getListaDefault() {
  return load().listaDefault ?? DEFAULTS.listaDefault;
}

export function getFleteDefault() {
  return load().fleteDefault ?? DEFAULTS.fleteDefault;
}

export function resetConfig() {
  _config = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}
