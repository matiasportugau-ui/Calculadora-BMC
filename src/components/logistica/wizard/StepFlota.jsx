/** Step 2 — transportista + camión + base de salida. */
import { ENV_T as T } from "../../../utils/enviosTheme.js";
import { listPlaces } from "../../../utils/logistica/pickupCatalog.js";

const TRUCK_OPTS = [8, 10, 12, 13, 14, 15];

export default function StepFlota({
  info = {},
  truckL,
  transportistas = [],
  places = [],
  onChangeInfo,
  onTruckL,
  onAddBase,
  newBaseLabel,
  setNewBaseLabel,
  newBaseUrl,
  setNewBaseUrl,
}) {
  const bases = listPlaces(places, "base");
  const inp = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    fontSize: 16,
    minHeight: 48,
  };

  return (
    <div className="envios-step-form" style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: T.muted }}>
        Transportista, camión y zona de salida (base) para el primer tramo hacia el levante.
      </p>
      <div>
        <label style={lbl}>Transportista</label>
        <input
          list="wiz-transportistas"
          style={inp}
          value={info.transportista || ""}
          onChange={(e) => onChangeInfo?.("transportista", e.target.value)}
          placeholder="Nombre del transportista"
        />
        <datalist id="wiz-transportistas">
          {transportistas.map((t) => (
            <option key={t.id || t.nombre} value={t.nombre} />
          ))}
        </datalist>
      </div>
      <div className="envios-flota-pair">
        <div>
          <label style={lbl}>Camión (largo m)</label>
          <select style={inp} value={truckL || ""} onChange={(e) => onTruckL?.(Number(e.target.value))}>
            <option value="">Elegir…</option>
            {TRUCK_OPTS.map((n) => (
              <option key={n} value={n}>
                {n} m
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Patente (opc.)</label>
          <input
            style={inp}
            value={info.patente || ""}
            onChange={(e) => onChangeInfo?.("patente", e.target.value)}
            placeholder="ABC 1234"
          />
        </div>
      </div>
      <div>
        <label style={lbl}>Base / zona de salida</label>
        <select
          style={inp}
          value={info.basePointId || ""}
          onChange={(e) => onChangeInfo?.("basePointId", e.target.value)}
        >
          <option value="">Elegir base…</option>
          {bases.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ padding: 10, borderRadius: 10, background: "#f8fafc", border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>+ Nueva base / zona de salida</div>
        <div style={{ display: "grid", gap: 8 }}>
          <input
            style={inp}
            placeholder="Nombre (ej. Base Cerro)"
            value={newBaseLabel || ""}
            onChange={(e) => setNewBaseLabel?.(e.target.value)}
          />
          <input
            style={inp}
            placeholder="Link Maps (opc.)"
            value={newBaseUrl || ""}
            onChange={(e) => setNewBaseUrl?.(e.target.value)}
          />
          <button type="button" onClick={onAddBase} style={btn}>
            Guardar base
          </button>
        </div>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" };
const btn = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  background: "#1e3a5f",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 44,
};
