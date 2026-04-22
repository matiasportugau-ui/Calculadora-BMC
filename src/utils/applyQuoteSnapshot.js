/**
 * Apply a buildQuote payload to calculator state setters in the correct order.
 * setters = { setScenario, setLP, setTecho, setPared, setCamara, setFlete, setProyecto }
 */
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
      t.zonas = t.zonas.map((z) => ({ largo: Number(z.largo) || 0, ancho: Number(z.ancho) || 0 }));
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
