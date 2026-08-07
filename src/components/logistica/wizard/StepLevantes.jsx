/** Step 3 — confirm pickup (levante) points. */
import { ENV_T as T } from "../../../utils/enviosTheme.js";
import { listPlaces } from "../../../utils/logistica/pickupCatalog.js";

export default function StepLevantes({
  stops = [],
  wizard = {},
  places = [],
  onWizardPatch,
  onStopPickup,
  onAddPickup,
  newLabel,
  setNewLabel,
  newUrl,
  setNewUrl,
}) {
  const pickups = listPlaces(places, "pickup");
  const single = wizard.singlePickup !== false;
  const inp = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${T.border}`,
    fontSize: 14,
    minHeight: 44,
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.4 }}>
        Confirmá dónde se levanta la mercadería. Casi siempre es un solo lugar (proveedor); a veces varios.
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={single}
          onChange={(e) => onWizardPatch?.({ singlePickup: e.target.checked })}
        />
        Un solo levante para todos los pedidos
      </label>
      {single ? (
        <div>
          <label style={lbl}>Lugar de levante</label>
          <select
            style={inp}
            value={wizard.defaultPickupPointId || ""}
            onChange={(e) => onWizardPatch?.({ defaultPickupPointId: e.target.value })}
          >
            <option value="">Elegir…</option>
            {pickups.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {wizard.defaultPickupPointId ? (
            <a
              href={pickups.find((p) => p.id === wizard.defaultPickupPointId)?.mapUrl || "#"}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12, color: "#2563eb" }}
            >
              Abrir mapa ↗
            </a>
          ) : null}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {stops.map((s) => (
            <div
              key={s.id}
              style={{ padding: 10, border: `1px solid ${T.border}`, borderRadius: 10, background: "#fff" }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
                {s.cliente || s.orderId || "Parada"}
              </div>
              <select
                style={inp}
                value={s.pickupPointId || ""}
                onChange={(e) => onStopPickup?.(s.id, e.target.value)}
              >
                <option value="">Elegir levante…</option>
                {pickups.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: 10, borderRadius: 10, background: "#f8fafc", border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>+ Nuevo punto de levante</div>
        <div style={{ display: "grid", gap: 8 }}>
          <input style={inp} placeholder="Nombre (ej. Depósito Z)" value={newLabel || ""} onChange={(e) => setNewLabel?.(e.target.value)} />
          <input style={inp} placeholder="Link Maps / share.google" value={newUrl || ""} onChange={(e) => setNewUrl?.(e.target.value)} />
          <button type="button" onClick={onAddPickup} style={btn}>
            Guardar levante
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
