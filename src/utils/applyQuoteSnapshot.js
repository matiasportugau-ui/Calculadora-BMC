/**
 * Apply a buildQuote payload to calculator state setters in the correct order.
 * setters = { setScenario, setLP, setTecho, setPared, setCamara, setFlete, setProyecto }
 *
 * Live UI derives dos_aguas from zonas[].dosAguas (techo.tipoAguas is deprecated).
 * Stripping zones down to {largo, ancho} silently flips quotes to una_agua (~2× panels).
 */

/**
 * Coerce zone dims and preserve dosAguas / annex preview markers.
 * When tipoAguas is known and a zone lacks dosAguas, stamp it.
 *
 * @param {Array<object>|null|undefined} zonas
 * @param {string|null|undefined} tipoAguas
 * @returns {Array<object>}
 */
export function normalizeSnapshotZonas(zonas, tipoAguas) {
  const rows = (Array.isArray(zonas) ? zonas : []).map((z) => {
    const raw = z && typeof z === "object" ? z : {};
    const row = {
      ...raw,
      largo: Number(raw.largo) || 0,
      ancho: Number(raw.ancho) || 0,
    };
    if (raw.dosAguas != null) row.dosAguas = !!raw.dosAguas;
    return row;
  });
  if (tipoAguas !== "dos_aguas" && tipoAguas !== "una_agua") return rows;
  const want = tipoAguas === "dos_aguas";
  return rows.map((z) => (z.dosAguas != null ? z : { ...z, dosAguas: want }));
}

export function applyQuoteSnapshot(payload, setters) {
  const { setScenario, setLP, setTecho, setPared, setCamara, setFlete, setProyecto } = setters;

  if (payload.scenario) setScenario(payload.scenario);
  if (payload.listaPrecios) setLP(payload.listaPrecios);
  if (payload.proyecto) setProyecto((prev) => ({ ...prev, ...payload.proyecto }));

  if (payload.techo) {
    const t = { ...payload.techo };
    if (t.pendiente != null) t.pendiente = Number(t.pendiente) || 0;
    if (t.espesor != null) t.espesor = String(t.espesor);
    if (Array.isArray(t.zonas)) {
      t.zonas = normalizeSnapshotZonas(t.zonas, t.tipoAguas);
    }
    setTecho((prev) => ({ ...prev, ...t }));
  }

  if (payload.pared) {
    const pw = { ...payload.pared };
    if (pw.espesor != null) pw.espesor = String(pw.espesor);
    if (pw.alto != null) pw.alto = Number(pw.alto) || 0;
    if (pw.perimetro != null) pw.perimetro = Number(pw.perimetro) || 0;
    if (pw.numEsqExt != null) pw.numEsqExt = Number(pw.numEsqExt) || 0;
    if (pw.numEsqInt != null) pw.numEsqInt = Number(pw.numEsqInt) || 0;
    setPared((prev) => ({ ...prev, ...pw }));
  }

  if (payload.camara) {
    const cam = { ...payload.camara };
    if (cam.largo_int != null) cam.largo_int = Number(cam.largo_int) || 0;
    if (cam.ancho_int != null) cam.ancho_int = Number(cam.ancho_int) || 0;
    if (cam.alto_int != null) cam.alto_int = Number(cam.alto_int) || 0;
    setCamara((prev) => ({ ...prev, ...cam }));
  }

  if (payload.flete != null) setFlete(Number(payload.flete) || 0);
}
