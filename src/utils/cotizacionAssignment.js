/**
 * Domain-specific routing rules for the BMC Admin&Ops team.
 *
 * Canonical codes come from the **planilla** CRM_Operativo!Parametros —
 * see docs/google-sheets-module/MAPPER-PRECISO-PLANILLAS-CODIGO.md.
 * The frontend mirrors the planilla casing so Google Sheets Data Validation
 * accepts the value when PATCH writes to col `Responsable`.
 *
 * The 5 operators:
 *   - `MP`      = Matías Portugau (titular; cotizador; final approver for refunds/credits)
 *   - `RA`      = Ramiro Amaral (cotizador #2; owns ML + Email cotizaciones)
 *   - `TIN`     = Martín Pérez ("Tincho"; dominant historical cotizador; showroom)
 *   - `SA`      = Sandra Arias (cobranzas / pagos; satellite — entra al admin
 *                sólo cuando ella misma atendió la llamada)
 *   - `PANELIN` = Panelin (AI agent) — asignaciones automáticas cuando no hay
 *                operador humano en el loop
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
 * Always returns one of `"MP" | "RA" | "TIN" | "SA" | "PANELIN"` — never null.
 * Default fallback is `"MP"` because Matías is the catch-all when no rule fires.
 *
 * @param {{origen?: string, consulta?: string}} input
 * @returns {"MP" | "RA" | "TIN" | "SA" | "PANELIN"}
 */
export function suggestOwner({ origen = "", consulta = "" } = {}) {
  const o = String(origen).trim().toUpperCase();
  const c = String(consulta).trim();

  // 1. Cobranzas / pagos → Sandra (regardless of channel — she owns the money side).
  if (COBRANZAS_RE.test(c)) return "SA";

  // 2. Soporte / post-venta → Matías (he approves refunds, credits, garantías).
  if (SOPORTE_RE.test(c)) return "MP";

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
      return "MP";
    case "FB":
    case "IG":
      // Redes sociales (residual <2% del volumen) — Matías hasta tener señal.
      return "MP";
    default:
      return "MP";
  }
}

/**
 * Map from operator code to human-readable first name. Used in UI badges.
 * Falls back to the raw code if unknown.
 */
const OPERATOR_NAMES = Object.freeze({
  MP: "Matías",
  RA: "Ramiro",
  TIN: "Martín",
  SA: "Sandra",
  PANELIN: "Panelin (AI)",
});

export function operatorLabel(code) {
  const k = String(code || "").trim().toUpperCase();
  // Legacy alias — see normalizeOperatorCode comment.
  const effective = LEGACY_CODE_ALIASES[k] || k;
  return OPERATOR_NAMES[effective] || code || "—";
}

/**
 * Full list of valid operator codes — useful for `<select>` options or test tables.
 * Casing matches CRM_Operativo!Parametros so server writes pass Sheets Data Validation.
 */
export const OPERATOR_CODES = Object.freeze(["MP", "RA", "TIN", "SA", "PANELIN"]);

/**
 * Backwards-compat alias for codes shipped before the planilla reconciliation.
 * `"MA"` was the previous identifier for Matías Portugau; the planilla canon is `"MP"`.
 * Existing planilla rows written under the old code still hold `"MA"` — accept them
 * on read/write to avoid 400s, but persist the canonical form so the row converges.
 * Drop this map once a backfill confirms no live row holds `"MA"`.
 */
const LEGACY_CODE_ALIASES = Object.freeze({ MA: "MP" });

/**
 * Normalize any operator string to the canonical code (UPPER + trim).
 * Returns the canonical code if valid (after applying legacy aliases),
 * or `null` if unrecognized. Used by the server before writing to the planilla.
 *
 * @param {string|null|undefined} raw
 * @returns {"MP" | "RA" | "TIN" | "SA" | "PANELIN" | null}
 */
export function normalizeOperatorCode(raw) {
  const k = String(raw || "").trim().toUpperCase();
  const effective = LEGACY_CODE_ALIASES[k] || k;
  return OPERATOR_CODES.includes(effective) ? effective : null;
}
