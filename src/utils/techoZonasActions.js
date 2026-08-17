/**
 * Techo zone merge helpers for chat/voice/aplicar_estado_calc actions.
 *
 * Live calc derives dos_aguas from zonas[].dosAguas (not techo.tipoAguas).
 * Replacing zonas with {largo, ancho} only silently flips quotes to una_agua.
 */

/**
 * @param {object|null|undefined} z
 * @returns {boolean}
 */
function isAnnex(z, isLateralAnnexZona) {
  if (typeof isLateralAnnexZona !== "function") return false;
  try {
    return !!isLateralAnnexZona(z);
  } catch {
    return false;
  }
}

/**
 * Merge incoming zone payloads onto previous zones, preserving dosAguas / preview / etc.
 * Incoming may be bare {largo, ancho} from agent tools.
 *
 * @param {Array<object>|null|undefined} prevZonas
 * @param {Array<object>} incoming
 * @returns {Array<object>}
 */
export function mergeTechoZonasPayload(prevZonas, incoming) {
  const prev = Array.isArray(prevZonas) ? prevZonas : [];
  const next = Array.isArray(incoming) ? incoming : [];
  return next.map((z, i) => {
    const prevZ = prev[i] && typeof prev[i] === "object" ? prev[i] : {};
    const raw = z && typeof z === "object" ? z : {};
    const merged = {
      ...prevZ,
      ...raw,
      largo: Number(raw.largo) || 0,
      ancho: Number(raw.ancho) || 0,
    };
    // Explicit dosAguas in payload wins; otherwise keep previous flag.
    if (raw.dosAguas != null) merged.dosAguas = !!raw.dosAguas;
    else if (prevZ.dosAguas != null) merged.dosAguas = !!prevZ.dosAguas;
    return merged;
  });
}

/**
 * Sync per-zone dosAguas flags from a tipoAguas string (agent still sends tipoAguas).
 * Lateral annexes are left unchanged.
 *
 * @param {Array<object>|null|undefined} zonas
 * @param {string|null|undefined} tipoAguas
 * @param {(z: object) => boolean} [isLateralAnnexZona]
 * @returns {Array<object>|null|undefined}
 */
export function syncZonasDosAguasFromTipoAguas(zonas, tipoAguas, isLateralAnnexZona) {
  if (!Array.isArray(zonas) || !zonas.length) return zonas;
  if (tipoAguas !== "dos_aguas" && tipoAguas !== "una_agua") return zonas;
  const want = tipoAguas === "dos_aguas";
  return zonas.map((z) => {
    if (!z || typeof z !== "object") return z;
    if (isAnnex(z, isLateralAnnexZona)) return z;
    return { ...z, dosAguas: want };
  });
}

/**
 * Stamp dosAguas onto agent-emitted setTechoZonas rows when tipoAguas is known.
 *
 * @param {Array<{largo:number, ancho:number}>} zonas
 * @param {string|null|undefined} tipoAguas
 * @returns {Array<object>}
 */
export function stampDosAguasOnZonas(zonas, tipoAguas) {
  const rows = Array.isArray(zonas) ? zonas : [];
  if (tipoAguas !== "dos_aguas" && tipoAguas !== "una_agua") return rows;
  const want = tipoAguas === "dos_aguas";
  return rows.map((z) => ({ ...z, dosAguas: want }));
}
