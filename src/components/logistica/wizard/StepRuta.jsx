/** Step 4 — suggested route legs. */
import { ENV_T as T } from "../../../utils/enviosTheme.js";
import { safeHttpUrl } from "../../../utils/logistica/safeExternalUrl.js";

const TYPE_ES = { base: "Salida", pickup: "Levante", delivery: "Entrega" };

export default function StepRuta({ route, onRecalcular, routeStale }) {
  const legs = route?.orderedLegs || [];
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.4 }}>
        Ruta sugerida: base del transportista → levante(s) → entregas. Podés recalcular si cambiaste pedidos o levantes.
      </p>
      {routeStale ? (
        <div style={{ padding: 10, borderRadius: 8, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: 12 }}>
          ⚠ La ruta está desactualizada respecto a pedidos/flota/levantes.
        </div>
      ) : null}
      <button type="button" onClick={onRecalcular} style={btn}>
        {legs.length ? "Recalcular ruta" : "Generar ruta sugerida"}
      </button>
      {!legs.length ? (
        <div style={{ fontSize: 12, color: T.muted }}>Todavía no hay tramos. Generá la sugerencia.</div>
      ) : (
        <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
          {legs.map((leg, i) => {
            const mapHref = safeHttpUrl(leg.mapUrl);
            return (
            <li key={`${leg.type}-${leg.refId}-${i}`} style={{ fontSize: 13 }}>
              <b>{TYPE_ES[leg.type] || leg.type}</b>: {leg.label}
              {leg.legKmFromPrev != null ? (
                <span style={{ color: T.muted, fontSize: 11 }}> · +{leg.legKmFromPrev.toFixed(1)} km</span>
              ) : null}
              {mapHref ? (
                <a href={mapHref} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 6, fontSize: 11 }}>
                  mapa
                </a>
              ) : null}
            </li>
            );
          })}
        </ol>
      )}
      {route?.totalKm != null ? (
        <div style={{ fontSize: 12, fontWeight: 700 }}>Total ~{route.totalKm.toFixed(0)} km (aire)</div>
      ) : null}
      {(route?.warnings || []).map((w) => (
        <div key={w} style={{ fontSize: 11, color: "#9a3412" }}>
          {w}
        </div>
      ))}
    </div>
  );
}

const btn = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 44,
  justifySelf: "start",
};
