/**
 * LoadWarnings — formal physical-limitation notes for load plan / transporter.
 */

export const LOAD_WARNING_CODES = {
  LENGTH_ON_SHORTER: "length_on_shorter",
  PANEL_ON_PROFILE: "panel_on_profile",
  OVERHANG: "overhang",
  MANUAL_EXCEPTION: "manual_exception",
  YARD_RELOAD: "yard_reload",
};

/**
 * @param {Partial<{
 *   id: string,
 *   code: string,
 *   severity: string,
 *   message: string,
 *   packageKeys: string[],
 *   stopIds: string[],
 *   acknowledged: boolean,
 *   createdAt: string,
 *   source: string,
 *   meta: object,
 * }>} input
 * @param {{ now?: () => string, id?: () => string }} [opts]
 */
export function createLoadWarning(input = {}, opts = {}) {
  const now = opts.now || (() => new Date().toISOString());
  const idFn =
    opts.id ||
    (() => `lw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
  const code = String(input.code || LOAD_WARNING_CODES.MANUAL_EXCEPTION);
  const severity = input.severity || (code === LOAD_WARNING_CODES.PANEL_ON_PROFILE ? "critical" : "warning");
  return {
    id: input.id || idFn(),
    code,
    severity,
    message: String(input.message || "").trim() || defaultMessageForCode(code, input.meta),
    packageKeys: Array.isArray(input.packageKeys) ? input.packageKeys.filter(Boolean) : [],
    stopIds: Array.isArray(input.stopIds) ? input.stopIds.filter(Boolean) : [],
    acknowledged: input.acknowledged === true,
    createdAt: input.createdAt || now(),
    source: input.source || "free_drag",
    meta: input.meta && typeof input.meta === "object" ? input.meta : {},
  };
}

/**
 * @param {string} code
 * @param {object} [meta]
 */
export function defaultMessageForCode(code, meta = {}) {
  if (code === LOAD_WARNING_CODES.LENGTH_ON_SHORTER) {
    const u = meta.upperLen != null ? `${Number(meta.upperLen).toFixed(1)}m` : "?";
    const s = meta.supportLen != null ? `${Number(meta.supportLen).toFixed(1)}m` : "?";
    return `Limitante física: bulto ${u} sobre apoyo ${s} — aceptado por operador`;
  }
  if (code === LOAD_WARNING_CODES.PANEL_ON_PROFILE) {
    return "Intento de panel sobre perfil (bloqueado o excepción)";
  }
  if (code === LOAD_WARNING_CODES.OVERHANG) {
    return "Saliente / overhang aceptado en estiba manual";
  }
  if (code === LOAD_WARNING_CODES.YARD_RELOAD) {
    return "Camión descargado a patio (yard) para reorganización manual";
  }
  return "Excepción de estiba registrada";
}

/**
 * @param {unknown[]} list
 * @returns {object[]}
 */
export function normalizeLoadWarnings(list = []) {
  if (!Array.isArray(list)) return [];
  return list
    .map((w) => {
      if (!w || typeof w !== "object") return null;
      return createLoadWarning(w, { now: () => w.createdAt || new Date().toISOString(), id: () => w.id || `lw-x` });
    })
    .filter(Boolean);
}

/**
 * @param {object[]} warnings
 * @param {object} warning
 */
export function appendLoadWarning(warnings = [], warning) {
  const w = createLoadWarning(warning || {});
  const list = normalizeLoadWarnings(warnings);
  // de-dupe same code+keys within 2s window soft: just append
  return [...list, w];
}

/**
 * @param {object[]} warnings
 * @param {string} id
 */
export function removeLoadWarning(warnings = [], id) {
  return normalizeLoadWarnings(warnings).filter((w) => w.id !== id);
}

/**
 * Lines for plan de carga / WhatsApp / print.
 * @param {object[]} warnings
 * @param {{ onlyAcknowledged?: boolean }} [opts]
 * @returns {string[]}
 */
export function formatLoadWarningsForPlan(warnings = [], opts = {}) {
  let list = normalizeLoadWarnings(warnings);
  if (opts.onlyAcknowledged) list = list.filter((w) => w.acknowledged);
  return list.map((w, i) => {
    const when = w.createdAt ? String(w.createdAt).slice(0, 10) : "";
    const ack = w.acknowledged ? "aceptado" : "pendiente";
    return `${i + 1}. ⚠ ${w.message}${when ? ` (${when}, ${ack})` : ` (${ack})`}`;
  });
}

/**
 * Build warning from length soft-check result.
 * @param {object} check - from checkLengthOnShorter
 * @param {string[]} packageKeys
 * @param {object} [extra]
 */
export function warningFromLengthCheck(check, packageKeys = [], extra = {}) {
  return createLoadWarning({
    code: LOAD_WARNING_CODES.LENGTH_ON_SHORTER,
    severity: "warning",
    message: defaultMessageForCode(LOAD_WARNING_CODES.LENGTH_ON_SHORTER, {
      upperLen: check?.upperLen,
      supportLen: check?.supportLen,
    }),
    packageKeys,
    acknowledged: true,
    source: "free_drag",
    meta: {
      upperLen: check?.upperLen,
      supportLen: check?.supportLen,
      ...extra.meta,
    },
    ...extra,
  });
}
