// Toolbar + factory order inspector for Modo irregular
// factory mode: full stepped pedido list | final_plane: compact tools only
import { C, FONT } from "../../data/constants.js";
import { buildFactoryOrderList } from "../../utils/irregularRoofLayout.js";

const CORTE_NOTE =
  "Corte en obra: paneles con extremos rectos (largos escalonados). Los cortes oblicuos los hace el cliente en obra.";

export default function IrregularModeChrome({
  enabled,
  onToggle,
  tool,
  onTool,
  layout,
  selectedStripId,
  onSelectStrip,
  onManualLength,
  onResetStrip,
  onClearCut,
  dense = false,
  /** factory = full pedido list; final_plane = tools only (right plant) */
  displayMode = "factory",
}) {
  const strip = layout?.strips?.find((s) => s.id === selectedStripId);
  const factory = enabled && layout?.strips?.length ? buildFactoryOrderList(layout) : null;
  const showOrder = displayMode === "factory";
  const btn = (active) => ({
    fontFamily: FONT,
    fontSize: dense ? 11 : 12,
    fontWeight: 600,
    padding: dense ? "4px 8px" : "6px 10px",
    borderRadius: 8,
    border: `1.5px solid ${active ? C.brand : C.border}`,
    background: active ? "rgba(0,113,227,0.12)" : C.surface,
    color: active ? C.brand : C.tp,
    cursor: "pointer",
  });

  return (
    <div data-bmc="irregular-chrome" data-mode={displayMode} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8, fontFamily: FONT }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <button type="button" style={btn(enabled)} onClick={onToggle} aria-pressed={enabled}>
          Modo irregular
        </button>
        {enabled && (
          <>
            <button type="button" style={btn(tool === "select")} onClick={() => onTool("select")} aria-pressed={tool === "select"}>
              Seleccionar
            </button>
            <button type="button" style={btn(tool === "cut")} onClick={() => onTool("cut")} aria-pressed={tool === "cut"}>
              Dibujar corte
            </button>
            <button type="button" style={btn(false)} onClick={onClearCut}>
              Limpiar corte
            </button>
          </>
        )}
      </div>

      {enabled && (
        <div
          style={{
            fontSize: 11,
            color: C.ts,
            background: "rgba(194,65,12,0.08)",
            border: "1px solid rgba(194,65,12,0.25)",
            borderRadius: 8,
            padding: "8px 10px",
            lineHeight: 1.35,
          }}
        >
          {displayMode === "final_plane"
            ? "Plano final: silueta del techo como queda instalado (sin escalera de paneles). El pedido a fábrica se detalla en la columna izquierda."
            : CORTE_NOTE}
        </div>
      )}

      {enabled && showOrder && layout?.totals && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 6, fontSize: 11 }}>
          <Metric label="Pedido m²" value={layout.totals.areaOrdered?.toFixed(2)} />
          <Metric label="Útil m²" value={layout.totals.areaUsable?.toFixed(2)} />
          <Metric
            label="Descarte obra"
            value={`${layout.totals.areaWasteSite?.toFixed(2)} (${layout.totals.wastePct?.toFixed(1)}%)`}
          />
          <Metric label="Paneles" value={String(layout.strips?.length ?? 0)} />
        </div>
      )}

      {enabled && showOrder && factory?.summaryByLength?.length > 0 && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: C.tp,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "8px 10px",
            lineHeight: 1.4,
          }}
        >
          <div style={{ fontSize: 10, color: C.ts, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
            Resumen fábrica
          </div>
          {factory.summaryByLength.map((g) => `${g.count}× ${g.L_order.toFixed(2)} m`).join(" · ")}
        </div>
      )}

      {enabled && showOrder && factory?.rows?.length > 0 && (
        <div style={{ overflowX: "auto", maxHeight: dense ? 160 : 200, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.tp, marginBottom: 4 }}>
            Pedido de paneles (largos escalonados)
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.ts }}>
                <th style={th}>Panel</th>
                <th style={th}>L pedido</th>
                <th style={th}>L cover</th>
                <th style={th}>Fuente</th>
              </tr>
            </thead>
            <tbody>
              {factory.rows.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onSelectStrip(s.id)}
                  style={{
                    cursor: "pointer",
                    background: selectedStripId === s.id ? "rgba(0,113,227,0.1)" : "transparent",
                  }}
                >
                  <td style={{ ...td, fontWeight: 700 }}>{s.id}</td>
                  <td style={td}>{s.L_order?.toFixed(2)} m</td>
                  <td style={td}>{s.L_cover?.toFixed(2)} m</td>
                  <td style={td}>{s.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {enabled && showOrder && strip && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, background: C.surface }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{strip.id} — editar largo</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 11, color: C.ts }}>
              L pedido (m)
              <input
                type="number"
                step={0.01}
                min={0}
                value={strip.L_order}
                onChange={(e) => onManualLength?.(strip.id, parseFloat(e.target.value) || 0)}
                style={{
                  display: "block",
                  marginTop: 4,
                  width: 96,
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  fontFamily: FONT,
                  fontSize: 13,
                }}
              />
            </label>
            <button type="button" style={{ ...btn(false), marginTop: 14 }} onClick={() => onResetStrip?.(strip.id)}>
              Auto
            </button>
          </div>
          <div style={{ fontSize: 10, color: C.ts, marginTop: 6 }}>
            Cover {strip.L_cover?.toFixed(2)} m · descarte {strip.wasteM2_site?.toFixed(3)} m²
          </div>
        </div>
      )}

      {enabled && tool === "cut" && (
        <div style={{ fontSize: 11, color: C.brand, fontWeight: 600 }}>
          Clic en dos puntos de la zona para definir el corte (regla + ángulo). Luego: izquierda = pedido escalonado · derecha = plano final liso.
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 8px" }}>
      <div style={{ fontSize: 10, color: C.ts, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.tp }}>{value}</div>
    </div>
  );
}

const th = { padding: "4px 6px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 };
const td = { padding: "4px 6px", borderBottom: `1px solid ${C.border}`, color: C.tp };
