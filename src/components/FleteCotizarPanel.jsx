/**
 * Cotizar flete — keeps existing FLETE / costo inputs; adds quote action + summary.
 */
import { useCallback, useState } from "react";
import { getBrouUsdSellRate } from "../utils/brouFx.js";
import { quoteFreightFromWizard } from "../utils/fleteEngine.js";

/**
 * @param {object} props
 * @param {object} props.proyecto
 * @param {(patch: Record<string, unknown>) => void} props.onProyectoPatch
 * @param {object} props.techo
 * @param {object} props.pared
 * @param {object|null} props.results
 * @param {Array} props.bomGroups
 * @param {number} props.flete
 * @param {(n: number) => void} props.setFlete
 * @param {string} props.fleteCosto
 * @param {(s: string) => void} props.setFleteCosto
 * @param {object} props.C theme colors
 * @param {object} props.inputS
 * @param {object} props.labelS
 */
export default function FleteCotizarPanel({
  proyecto,
  onProyectoPatch,
  techo,
  pared,
  results,
  bomGroups,
  flete,
  setFlete,
  fleteCosto,
  setFleteCosto,
  C,
  inputS,
  labelS,
}) {
  const [retiroEnPlanta, setRetiroEnPlanta] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  const runQuote = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const fx = await getBrouUsdSellRate();
      const q = quoteFreightFromWizard({
        proyecto,
        techo,
        pared,
        results,
        bomGroups,
        retiroEnPlanta,
        fxRateUyuPerUsd: fx.rate,
      });
      setSummary(q.summary);

      if (q.ok && q.ventaUsd != null) {
        setFlete(Number(q.ventaUsd) || 0);
        if (q.costoUsd != null) setFleteCosto(String(q.costoUsd));
      } else if (q.mode === "needs_fx") {
        setError(
          `Falta tipo de cambio BROU (${fx.error || fx.source}). Cargá flete a mano o reintentá.`
        );
      } else if (q.mode === "especial") {
        setError(q.summary?.label || "Cotización especial — completar a mano.");
      } else {
        setError(q.error || "No se pudo cotizar flete.");
      }
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }, [
    proyecto,
    techo,
    pared,
    results,
    bomGroups,
    retiroEnPlanta,
    setFlete,
    setFleteCosto,
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.tp, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={retiroEnPlanta}
          onChange={(e) => setRetiroEnPlanta(e.target.checked)}
        />
        Retiro en planta (Colonia Nicolich) — USD 0
      </label>

      <div>
        <div style={labelS}>Destino / dirección (completa datos del proyecto)</div>
        <input
          style={inputS}
          value={proyecto?.direccion || ""}
          onChange={(e) => onProyectoPatch({ direccion: e.target.value })}
          placeholder="ej. Maldonado / Ciudad de la Costa / Montevideo…"
        />
      </div>

      <button
        type="button"
        onClick={runQuote}
        disabled={busy}
        style={{
          padding: "8px 14px",
          borderRadius: 10,
          border: `1.5px solid ${C.primary}`,
          background: busy ? C.surfaceAlt : C.primarySoft || "#eff6ff",
          color: C.primary,
          fontWeight: 700,
          fontSize: 12,
          cursor: busy ? "wait" : "pointer",
          alignSelf: "flex-start",
        }}
      >
        {busy ? "Cotizando…" : "Cotizar flete"}
      </button>

      {summary?.label && (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: C.tp,
            background: C.surfaceAlt,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "10px 12px",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Resumen</div>
          <div>{summary.label}</div>
          <div style={{ color: C.ts, marginTop: 4, fontSize: 11 }}>
            Zona: {summary.zona}
            {summary.vehicle ? ` · Vehículo: ${summary.vehicle}` : ""}
            {summary.filasUsadas != null ? ` · Filas: ${summary.filasUsadas}` : ""}
            {summary.largoMax ? ` · Largo máx: ${summary.largoMax} m` : ""}
            {summary.fxRate ? ` · TC: ${summary.fxRate}` : ""}
          </div>
          {Array.isArray(summary.warns) && summary.warns.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: C.warning || "#b45309" }}>
              {summary.warns.slice(0, 4).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: C.danger || "#b91c1c", lineHeight: 1.4 }}>{error}</div>
      )}

      <div style={{ fontSize: 11, color: C.ts }}>
        Los montos quedan editables abajo (venta actual: USD {Number(flete) || 0}
        {fleteCosto ? ` · costo ${fleteCosto}` : ""}).
      </div>
    </div>
  );
}
