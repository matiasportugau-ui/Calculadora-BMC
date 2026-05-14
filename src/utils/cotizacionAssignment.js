/**
 * Domain-specific routing rules for the BMC Admin&Ops team.
 *
 * The 4 operators (col `Asig.` in Admin 2.0 and `Responsable` in CRM_Operativo):
 *   - `MA`  = Matías Portugau (titular; cotizador; final approver for refunds/credits)
 *   - `RA`  = Ramiro Amaral (cotizador #2; owns ML + Email cotizaciones)
 *   - `TIN` = Martín Pérez ("Tincho"; dominant historical cotizador; showroom)
 *   - `SA`  = Sandra Arias (cobranzas / pagos; satellite — entra al admin sólo
 *            cuando ella misma atendió la llamada)
 *
 * Rules below were inferred from the 2026-05-14 data analysis (n=353 cotizaciones)
 * and the team discovery interview. They are SOFT suggestions — the UI must always
 * allow the operator to override the assignment.
 *
 * Channel codes (col F in Admin 2.0):
 *   WA = WhatsApp        EM = Email           ML = MercadoLibre
 *   CL = Cliente físico  LO = Local/showroom  LL = Llamada
 *   FB = Facebook        IG = Instagram
 */

const COBRANZAS_RE =
  /\b(pago|cobro|factura|recibo|transferencia|saldo|se[nñ]a|abonar|deuda|cobrar|pagar)\b/i;

const SOPORTE_RE =
  /\b(queja|devoluci[oó]n|reclamo|defecto|fallo|garant[ií]a|roto|mal\s+estado|reclam[ao]|recibí mal)\b/i;

/**
 * Pure function: pick the suggested operator code for an Admin 2.0 row.
 *
 * Always returns one of `"MA" | "RA" | "TIN" | "SA"` — never null. Default fallback
 * is `"MA"` because Matías is the catch-all when no rule fires.
 *
 * @param {{origen?: string, consulta?: string}} input
 * @returns {"MA" | "RA" | "TIN" | "SA"}
 */
export function suggestOwner({ origen = "", consulta = "" } = {}) {
  const o = String(origen).trim().toUpperCase();
  const c = String(consulta).trim();

  // 1. Cobranzas / pagos → Sandra (regardless of channel — she owns the money side).
  if (COBRANZAS_RE.test(c)) return "SA";

  // 2. Soporte / post-venta → Matías (he approves refunds, credits, garantías).
  if (SOPORTE_RE.test(c)) return "MA";

  // 3. Channel-based routing for cotizaciones nuevas.
  switch (o) {
    case "WA": {
      // WA telegraphic short specs typically land with Martín (historical dominant).
      // Longer/complex consultas → Ramiro.
      return c.length < 80 ? "TIN" : "RA";
    }
    case "ML":
      // MercadoLibre via PANELSIM — Ramiro owns the ML pipeline.
      return "RA";
    case "EM":
      // Email — formal / longer consults → Ramiro.
      return "RA";
    case "CL":
    case "LO":
      // Cliente físico o local (showroom) — Martín atiende showroom.
      return "TIN";
    case "LL":
      // Llamada — quien atendió la carga; default Matías hasta que se confirme.
      return "MA";
    case "FB":
    case "IG":
      // Redes sociales (residual <2% del volumen) — Matías hasta tener señal.
      return "MA";
    default:
      return "MA";
  }
}

/**
 * Map from operator code to human-readable first name. Used in UI badges.
 * Falls back to the raw code if unknown.
 */
const OPERATOR_NAMES = Object.freeze({
  MA: "Matías",
  RA: "Ramiro",
  TIN: "Martín",
  SA: "Sandra",
});

export function operatorLabel(code) {
  const k = String(code || "").trim().toUpperCase();
  return OPERATOR_NAMES[k] || code || "—";
}

/**
 * Full list of valid operator codes — useful for `<select>` options or test tables.
 */
export const OPERATOR_CODES = Object.freeze(["MA", "RA", "TIN", "SA"]);
