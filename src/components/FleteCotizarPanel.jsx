/**
 * Cotizar flete — Quote surface (wizard Flete 10/11).
 * UI: Liquid Glass crystal chrome on summary; solid inputs (DESIGN-UI.md).
 * U2: Enviar a Logística bridge via sessionStorage.
 */
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBrouUsdSellRate } from "../utils/brouFx.js";
import {
  quoteFreightFromWizard,
  buildPanelLoadsFromQuote,
} from "../utils/fleteEngine.js";
import {
  buildBridgePayload,
  saveBridgePayload,
} from "../utils/logistica/bridgePayload.js";

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
}) {
  const navigate = useNavigate();
  const [retiroEnPlanta, setRetiroEnPlanta] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  /** @type {[{ panels: object[], quote: object, destino: string }|null, Function]} */
  const [lastQuote, setLastQuote] = useState(null);

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

      const destino = [proyecto?.direccion, proyecto?.departamento, proyecto?.localidad, proyecto?.zona]
        .filter(Boolean)
        .join(" ");
      const panels = buildPanelLoadsFromQuote({ techo, pared, results });
      setLastQuote({ panels, quote: q, destino });

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

  const sendToLogistica = useCallback(() => {
    const panels =
      lastQuote?.panels?.length > 0
        ? lastQuote.panels
        : buildPanelLoadsFromQuote({ techo, pared, results });
    if (!panels.length) {
      setError("No hay paneles en la cotización para enviar a Logística.");
      return;
    }
    const destino =
      lastQuote?.destino ||
      [proyecto?.direccion, proyecto?.departamento, proyecto?.localidad]
        .filter(Boolean)
        .join(" ") ||
      proyecto?.direccion ||
      "";
    const payload = buildBridgePayload({
      destino,
      panels,
      quote: lastQuote?.quote || {
        ok: true,
        mode: "manual",
        ventaUsd: Number(flete) || 0,
        costoUsd: fleteCosto ? Number(fleteCosto) : null,
        summary: summary || { zona: "manual", label: `Flete USD ${Number(flete) || 0}` },
      },
      proyectoRef: {
        cliente: proyecto?.cliente || proyecto?.nombre || null,
        direccion: proyecto?.direccion || destino || null,
      },
    });
    saveBridgePayload(payload);
    navigate("/logistica");
  }, [
    lastQuote,
    techo,
    pared,
    results,
    proyecto,
    flete,
    fleteCosto,
    summary,
    navigate,
  ]);

  const missingDestino = !retiroEnPlanta && !String(proyecto?.direccion || "").trim();
  const canBridge =
    (lastQuote?.panels?.length > 0 || buildPanelLoadsFromQuote({ techo, pared, results }).length > 0) &&
    (lastQuote != null || Number(flete) > 0);

  return (
    <div className="envios-quote">
      <label className="envios-check">
        <input
          type="checkbox"
          checked={retiroEnPlanta}
          onChange={(e) => setRetiroEnPlanta(e.target.checked)}
        />
        Retiro en planta (Colonia Nicolich) — USD 0
      </label>

      <div>
        <label className="envios-label" htmlFor="envios-destino">
          Destino / dirección (completa datos del proyecto)
        </label>
        <input
          id="envios-destino"
          className="envios-field"
          value={proyecto?.direccion || ""}
          onChange={(e) => onProyectoPatch({ direccion: e.target.value })}
          placeholder="ej. Maldonado / Ciudad de la Costa / Montevideo…"
          autoComplete="street-address"
        />
        {missingDestino && (
          <div className="envios-hint" style={{ marginTop: 6 }}>
            Sin destino se cotiza como zona especial (precio a mano). Completá dirección o marcá retiro en
            planta.
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" className="envios-btn-primary" onClick={runQuote} disabled={busy}>
          {busy ? "Cotizando…" : "Cotizar flete"}
        </button>
        <button
          type="button"
          className="envios-btn-glass"
          onClick={sendToLogistica}
          disabled={!canBridge || busy}
          title="Envía paneles y destino a /logistica"
        >
          Enviar a Logística
        </button>
      </div>

      {summary?.label && (
        <div className="envios-summary" role="status">
          <div className="envios-summary__title">Resumen</div>
          <div className="envios-summary__body">{summary.label}</div>
          <div className="envios-summary__meta">
            Zona: {summary.zona}
            {summary.vehicle ? ` · Vehículo: ${summary.vehicle}` : ""}
            {summary.filasUsadas != null ? ` · Filas: ${summary.filasUsadas}` : ""}
            {summary.largoMax ? ` · Largo máx: ${summary.largoMax} m` : ""}
            {summary.fxRate ? ` · TC: ${summary.fxRate}` : ""}
          </div>
          {Array.isArray(summary.warns) && summary.warns.length > 0 && (
            <ul className="envios-summary__warns">
              {summary.warns.slice(0, 4).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div className="envios-alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="envios-hint">
        Los montos quedan editables abajo (venta actual: USD {Number(flete) || 0}
        {fleteCosto ? ` · costo ${fleteCosto}` : ""}).
        {canBridge ? " · Podés enviar paneles a Logística sin re-tipear." : ""}
      </div>
    </div>
  );
}
