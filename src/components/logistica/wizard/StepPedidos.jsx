/** Step 1 — load pedidos from Ventas + list in this trip. */
import { ENV_T as T } from "../../../utils/enviosTheme.js";
import { isStopIncompleteForAi } from "../../../utils/logistica/aiVerifyStop.js";

/**
 * @param {{
 *   stops?: object[],
 *   onRemoveStop?: (id: string) => void,
 *   search?: string,
 *   onSearchChange?: (v: string) => void,
 *   onBuscar?: () => void,
 *   onCargarActuales?: () => void,
 *   loadSh?: boolean,
 *   shErr?: string,
 *   autoLoadMsg?: string,
 *   ventasRowCount?: number,
 *   results?: object[],
 *   onAddResult?: (row: object) => void,
 *   activeReparto?: object|null,
 *   onAiVerify?: (stop: object) => void,
 *   onGeocode?: (stopId: string) => void,
 *   geocodingStopId?: string|null,
 *   aiVerifyModal?: { loading?: boolean, stopId?: string }|null,
 * }} props
 */
export default function StepPedidos({
  stops = [],
  onRemoveStop,
  search = "",
  onSearchChange,
  onBuscar,
  onCargarActuales,
  loadSh = false,
  shErr = "",
  autoLoadMsg = "",
  ventasRowCount = 0,
  results = [],
  onAddResult,
  activeReparto = null,
  onAiVerify,
  onGeocode,
  geocodingStopId = null,
  aiVerifyModal = null,
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.4 }}>
        Cargá los pedidos desde Ventas acá mismo. La autocarga de paneles corre al agregar cada parada.
      </p>

      <div
        style={{
          padding: 12,
          borderRadius: 12,
          background: "#e8f1fb",
          border: "1px solid #bfdbfe",
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: T.brand }}>🔍 Buscar cliente en Ventas</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            id="wizard-log-search"
            name="wizard-log-search"
            aria-label="Buscar cliente"
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onBuscar?.()}
            placeholder="Nombre, pedido, tel, dirección..."
            style={inp}
          />
          <button type="button" onClick={onBuscar} disabled={loadSh} style={btnPrimary}>
            {loadSh ? "⏳" : "Buscar"}
          </button>
          <button type="button" onClick={onCargarActuales} disabled={loadSh} style={btnOutline}>
            Cargar actuales
          </button>
        </div>
        {ventasRowCount ? (
          <div style={{ fontSize: 11, color: T.muted }}>Última lectura: {ventasRowCount} filas en pestaña actual.</div>
        ) : null}
        {shErr ? (
          <div style={{ color: "#b42318", fontSize: 12, padding: "7px 10px", background: "#ffeceb", borderRadius: 8 }}>
            {shErr}
          </div>
        ) : null}
        {autoLoadMsg ? (
          <div
            style={{
              color: T.brand,
              fontSize: 12,
              padding: "7px 10px",
              background: "#fff",
              borderRadius: 8,
              border: "1px solid #bfdbfe",
            }}
          >
            {autoLoadMsg}
          </div>
        ) : null}

        {results.length ? (
          <div style={{ display: "grid", gap: 6, maxHeight: 280, overflow: "auto" }}>
            {results.map((r, i) => {
              const inReparto = stops.some(
                (s) =>
                  (r.orderId && String(s.orderId) === String(r.orderId)) ||
                  (r.nombre && String(s.cliente || "").toLowerCase() === String(r.nombre || "").toLowerCase()),
              );
              const chipColor = inReparto
                ? "#c2410c"
                : r.coordination?.status === "enviado"
                  ? "#16a34a"
                  : r.coordination?.status === "coordinado"
                    ? r.coordinationColor || "#2563eb"
                    : "#94a3b8";
              const chipBg = inReparto
                ? "#fff7ed"
                : r.coordination?.status === "enviado"
                  ? "#dcfce7"
                  : r.coordination?.status === "coordinado"
                    ? "#eff6ff"
                    : "#f1f5f9";
              return (
                <button
                  key={`${r.orderId || r.nombre || "r"}-${r.ventasSheetRow1Based || i}`}
                  type="button"
                  onClick={() => onAddResult?.(r)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    textAlign: "left",
                    background: "#fff",
                    border: "1px solid #bfdbfe",
                    borderRadius: 10,
                    padding: "10px 12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, color: T.brand, fontSize: 13 }}>{r.nombre || "—"}</span>
                      {r.orderId || r.cotizacionId ? (
                        <span style={{ fontSize: 11, color: T.muted, fontWeight: 600 }}>
                          #{r.orderId || r.cotizacionId}
                        </span>
                      ) : null}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: chipColor,
                          background: chipBg,
                          border: `1.5px solid ${chipColor}`,
                          borderRadius: 999,
                          padding: "2px 8px",
                        }}
                      >
                        {inReparto
                          ? "En este reparto"
                          : activeReparto?.status === "en_coordinacion" && stops.length
                            ? "Por coordinar"
                            : r.coordinationCaption || r.coordination?.label || "Por coordinar"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>
                      📍{r.dir || "—"} · 📞{r.tel || "—"}
                    </div>
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                      background: "#16a34a",
                      borderRadius: 8,
                      padding: "6px 10px",
                    }}
                  >
                    + Parada
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: T.brand }}>
          En este envío ({stops.length})
        </div>
        {!stops.length ? (
          <div style={{ fontSize: 12, color: T.muted }}>
            Todavía no hay pedidos. Buscá o usá <b>Cargar actuales</b> y tocá + Parada.
          </div>
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
                <div style={{ minWidth: 0, flex: 1 }}>
                  <b>{s.cliente || "Sin nombre"}</b>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    #{s.orderId || s.cotizacionId || "—"} · {s.paneles?.length || 0} líneas panel
                    {s.geo ? " · geo ✓" : ""}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {typeof onGeocode === "function" ? (
                      <button
                        type="button"
                        onClick={() => onGeocode(s.id)}
                        disabled={geocodingStopId === s.id}
                        style={btnChip}
                      >
                        {geocodingStopId === s.id ? "⏳ Geo…" : s.geo ? "↻ Re-geo" : "📍 Geocodificar"}
                      </button>
                    ) : null}
                    {typeof onAiVerify === "function" &&
                    (isStopIncompleteForAi(s) || s.pdfLink || s.rawSheetText) ? (
                      <button
                        type="button"
                        onClick={() => onAiVerify(s)}
                        disabled={aiVerifyModal?.loading && aiVerifyModal?.stopId === s.id}
                        style={btnChipAi}
                        title="IA propone completar parada — vos confirmás"
                      >
                        {aiVerifyModal?.loading && aiVerifyModal?.stopId === s.id
                          ? "⏳ IA…"
                          : "✨ Verificar con IA"}
                      </button>
                    ) : null}
                  </div>
                </div>
                {typeof onRemoveStop === "function" ? (
                  <button
                    type="button"
                    onClick={() => onRemoveStop(s.id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#dc2626",
                      cursor: "pointer",
                      fontSize: 12,
                      alignSelf: "flex-start",
                    }}
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

const inp = {
  flex: 1,
  minWidth: 160,
  padding: "9px 12px",
  borderRadius: 8,
  border: "1.5px solid #bfdbfe",
  fontSize: 13,
  fontFamily: "inherit",
  minHeight: 40,
  background: "#fff",
};

const btnPrimary = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  minHeight: 40,
};

const btnChip = {
  fontSize: 11,
  fontWeight: 700,
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #bfdbfe",
  background: "#fff",
  color: "#1e3a5f",
  cursor: "pointer",
  minHeight: 36,
};
const btnChipAi = {
  ...btnChip,
  border: "1px solid #c4b5fd",
  background: "#f5f3ff",
  color: "#5b21b6",
};
const btnOutline = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1.5px solid #93c5fd",
  background: "#fff",
  color: "#1e40af",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  minHeight: 40,
};
