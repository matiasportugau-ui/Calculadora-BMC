/**
 * Resolve techo tipoAguas for calc/agent paths.
 *
 * Live UI derives aguas from root zonas[].dosAguas (techo.tipoAguas is
 * deprecated and often stale — toggling "2 Aguas" does not update it).
 * Agents still send tipoAguas without per-zone flags; fall back when zones
 * have not spoken explicitly.
 *
 * @param {object} [techo]
 * @returns {"una_agua"|"dos_aguas"}
 */
export function resolveTipoAguas(techo) {
  const zonas = Array.isArray(techo?.zonas) ? techo.zonas : [];
  const roots = zonas.filter((z) => {
    const ap = Number(z?.preview?.attachParentGi);
    return !(Number.isFinite(ap) && ap >= 0);
  });

  const anyTrue = roots.some((z) => z?.dosAguas === true);
  if (anyTrue) return "dos_aguas";

  // Explicit false (or only undefined/missing) after a user toggle: zones win
  // over a stale techo.tipoAguas left by an earlier agent setTecho.
  const anyExplicit = roots.some((z) => z?.dosAguas === true || z?.dosAguas === false);
  if (anyExplicit) return "una_agua";

  return techo?.tipoAguas === "dos_aguas" ? "dos_aguas" : "una_agua";
}
