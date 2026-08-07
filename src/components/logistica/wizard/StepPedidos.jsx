/** Step 1 — select / list pedidos (stops). Parent owns Ventas search. */
import { ENV_T as T } from "../../../utils/enviosTheme.js";

export default function StepPedidos({
  stops = [],
  onRemoveStop,
  searchSlot,
  resultsSlot,
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.4 }}>
        Seleccioná los pedidos de Ventas. La autocarga de paneles corre al agregar cada parada.
      </p>
      {searchSlot}
      {resultsSlot}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: T.brand }}>
          En este envío ({stops.length})
        </div>
        {!stops.length ? (
          <div style={{ fontSize: 12, color: T.muted }}>Todavía no hay pedidos. Usá Buscar / Cargar actuales.</div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
            {stops.map((s) => (
              <li
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  background: "#fff",
                  fontSize: 13,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <b>{s.cliente || "Sin nombre"}</b>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    #{s.orderId || s.cotizacionId || "—"} · {s.paneles?.length || 0} líneas panel
                  </div>
                </div>
                {typeof onRemoveStop === "function" ? (
                  <button
                    type="button"
                    onClick={() => onRemoveStop(s.id)}
                    style={{ border: "none", background: "transparent", color: "#dc2626", cursor: "pointer", fontSize: 12 }}
                  >
                    Quitar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
