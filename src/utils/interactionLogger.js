// ═══════════════════════════════════════════════════════════════════════════
// interactionLogger.js — Log de interacción para flujo de modificaciones
// Captura acciones del usuario para que el agente pueda aplicar cambios integrados
// Solo activo en desarrollo (import.meta.env.DEV)
// ═══════════════════════════════════════════════════════════════════════════

const MAX_ENTRIES = 200;
const entries = [];
let sessionStart = null;
let stateSnapshotGetter = null;

function isDev() {
  return typeof import.meta !== "undefined" && import.meta.env?.DEV === true;
}

/**
 * Registra el getter del estado actual (llamado por el componente).
 */
export function setStateSnapshotGetter(getter) {
  stateSnapshotGetter = getter;
}

/**
 * Registra una acción de usuario.
 * @param {string} type - Tipo: 'change' | 'click' | 'focus' | 'custom'
 * @param {string} target - Qué cambió (ej: 'scenario', 'techo.familia', 'listaPrecios')
 * @param {object} payload - { prev, next, value, ... }
 */
export function log(type, target, payload = {}) {
  if (!isDev()) return;
  if (!sessionStart) sessionStart = new Date().toISOString();
  const entry = {
    t: Date.now(),
    type,
    target,
    ...payload,
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
}

/**
 * Log de cambio de estado (para setters envueltos).
 */
export function logChange(target, prev, next) {
  if (!isDev()) return;
  log("change", target, { prev, next });
}

/**
 * Log de click o selección.
 */
export function logClick(target, value) {
  if (!isDev()) return;
  log("click", target, { value });
}

/**
 * Limpia el log.
 */
export function clear() {
  entries.length = 0;
  sessionStart = null;
}

/**
 * Obtiene el log completo como array.
 */
export function getLog() {
  return [...entries];
}

/**
 * Genera un resumen legible del estado actual.
 */
function buildSessionSummary(snapshot) {
  if (!snapshot) return null;
  const parts = [];
  if (snapshot.scenario) parts.push(`Escenario: ${snapshot.scenario}`);
  if (snapshot.listaPrecios) parts.push(`Lista: ${snapshot.listaPrecios}`);
  if (snapshot.techo?.familia) {
    parts.push(`Techo: ${snapshot.techo.familia} ${snapshot.techo.espesor || ""}mm ${snapshot.techo.color || ""}`);
    if (snapshot.techo.zonas?.length) {
      const areas = snapshot.techo.zonas.map(z => `${z.largo}×${z.ancho}`).join(", ");
      parts.push(`Zonas: ${areas}`);
    }
  }
  if (snapshot.pared?.familia) {
    parts.push(`Pared: ${snapshot.pared.familia} ${snapshot.pared.espesor || ""}mm`);
  }
  if (snapshot.proyecto?.nombre) parts.push(`Cliente: ${snapshot.proyecto.nombre}`);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Exporta el log como JSON para pegar en chat.
 */
export function exportAsJSON() {
  const snapshot = typeof stateSnapshotGetter === "function" ? stateSnapshotGetter() : null;
  const data = {
    sessionStarted: sessionStart || new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    summary: buildSessionSummary(snapshot),
    stateSnapshot: snapshot,
    actions: getLog(),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Genera el bloque listo para pegar en Cursor (con plantilla de modificación).
 */
export function exportForCursor() {
  const json = exportAsJSON();
  return `## Modificación Calculadora BMC

**Descripción de lo que quiero cambiar:**

[Escribí acá tu modificación — ej: "Cuando selecciono ISODEC 100mm y área > 100m², mostrar badge Promo"]

---

**Log de interacción (completo):**

\`\`\`json
${json}
\`\`\``;
}

/**
 * Copia el log al portapapeles (JSON raw).
 */
export async function copyToClipboard() {
  if (typeof navigator?.clipboard === "undefined") return false;
  try {
    await navigator.clipboard.writeText(exportAsJSON());
    return true;
  } catch {
    return false;
  }
}

/**
 * Copia el formato listo para Cursor (con plantilla).
 */
export async function copyForCursor() {
  if (typeof navigator?.clipboard === "undefined") return false;
  try {
    await navigator.clipboard.writeText(exportForCursor());
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtiene el payload completo para enviar al API (guardar en archivo).
 */
export function getExportPayload() {
  const snapshot = typeof stateSnapshotGetter === "function" ? stateSnapshotGetter() : null;
  return {
    sessionStarted: sessionStart || new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "",
    summary: buildSessionSummary(snapshot),
    stateSnapshot: snapshot,
    actions: getLog(),
  };
}

/**
 * Guarda el log en archivo vía API (requiere dev:full con API en 3001).
 */
export async function saveToFile() {
  try {
    const res = await fetch("/calc/interaction-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getExportPayload()),
    });
    const data = await res.json();
    return data.ok ? { ok: true, path: data.path } : { ok: false, error: data.error };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Crea un setter que registra cambios.
 */
export function wrapSetter(setter, target) {
  return (valueOrUpdater) => {
    setter((prev) => {
      const next = typeof valueOrUpdater === "function" ? valueOrUpdater(prev) : valueOrUpdater;
      logChange(target, prev, next);
      return next;
    });
  };
}
