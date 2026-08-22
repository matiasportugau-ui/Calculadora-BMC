/** Step 3 — confirm pickup (levante) points, grouped by origin. */
import { ENV_T as T } from "../../../utils/enviosTheme.js";
import { listPlaces } from "../../../utils/logistica/pickupCatalog.js";
import { safeHttpUrl } from "../../../utils/logistica/safeExternalUrl.js";
import {
  consolidateLevantes,
  originLabelForStop,
  pickupIdForStop,
} from "../../../utils/logistica/wizardState.js";

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
  const single = wizard.singlePickup === true;
  const defaultPickupMapHref = safeHttpUrl(
    pickups.find((p) => p.id === wizard.defaultPickupPointId)?.mapUrl,
  );
  const { groups, missing } = consolidateLevantes(stops, wizard, pickups);
  const approved = wizard.unassignedPickupApproved === true;
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
        Origen por carga: al elegir levante, el pedido se agrupa con los del mismo origen. Los que faltan quedan aparte hasta que les asignes planta o confirmes dejarlos sin origen.
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={single}
          onChange={(e) =>
            onWizardPatch?.({
              singlePickup: e.target.checked,
              unassignedPickupApproved: false,
            })
          }
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
          {defaultPickupMapHref ? (
            <a
              href={defaultPickupMapHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: "#2563eb" }}
            >
              Abrir mapa ↗
            </a>
          ) : null}
          <OriginGroup
            id={wizard.defaultPickupPointId || "none"}
            label={
              pickups.find((p) => p.id === wizard.defaultPickupPointId)?.label || "Sin origen"
            }
            ok={Boolean(wizard.defaultPickupPointId)}
            stops={stops}
            wizard={wizard}
            places={pickups}
          />
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {groups.length || missing.length ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                alignItems: "center",
              }}
              data-testid="levantes-summary"
            >
              {groups.map((g) => (
                <span key={g.id} style={chipOk}>
                  ✓ {g.label} · {g.stops.length}
                </span>
              ))}
              {missing.length ? (
                <span style={chipWarn}>⚠ Sin origen · {missing.length}</span>
              ) : (
                <span style={chipOk}>Todas con origen</span>
              )}
            </div>
          ) : null}

          {groups.map((g) => (
            <OriginGroup
              key={g.id}
              id={g.id}
              label={g.label}
              ok
              stops={g.stops}
              wizard={wizard}
              places={pickups}
              pickups={pickups}
              onStopPickup={onStopPickup}
              showSelect
            />
          ))}

          {missing.length ? (
            <OriginGroup
              id="missing"
              label="Sin origen"
              ok={false}
              stops={missing}
              wizard={wizard}
              places={pickups}
              pickups={pickups}
              onStopPickup={onStopPickup}
              showSelect
            />
          ) : null}

          {missing.length ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "#fff7ed",
                border: "1px solid #fdba74",
              }}
              data-testid="levantes-unassigned-warning"
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#9a3412", marginBottom: 6 }}>
                ⚠ {missing.length} carga{missing.length === 1 ? "" : "s"} sin origen
              </div>
              <div style={{ fontSize: 12, color: "#9a3412", lineHeight: 1.4, marginBottom: 8 }}>
                {missing.map((s) => s.cliente || s.orderId || "Parada").join(", ")}. Dejarlas así es
                adrede: hay que aprobarlo para continuar.
              </div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => onWizardPatch?.({ unassignedPickupApproved: e.target.checked })}
                />
                <span>
                  Confirmo dejar {missing.length} carga{missing.length === 1 ? "" : "s"} sin origen
                </span>
              </label>
            </div>
          ) : null}
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

function OriginGroup({
  id,
  label,
  ok,
  stops = [],
  wizard,
  places,
  pickups = [],
  onStopPickup,
  showSelect = false,
}) {
  const inp = {
    width: "100%",
    boxSizing: "border-box",
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${ok ? "#86efac" : "#fbbf24"}`,
    fontSize: 14,
    minHeight: 44,
  };
  return (
    <section
      className={`envios-levante-group${ok ? "" : " is-missing"}`}
      data-origen-group={id}
      data-testid={`origen-group-${id}`}
    >
      <header className="envios-levante-group__head">
        <span style={ok ? chipOk : chipWarn}>
          {ok ? "✓ " : "⚠ "}
          {label} · {stops.length}
        </span>
      </header>
      <ul className="envios-levante-group__list">
        {stops.map((s) => {
          const pid = pickupIdForStop(s, wizard);
          const assigned = Boolean(pid);
          return (
            <li
              key={s.id}
              data-cliente-row
              data-levante-state={assigned ? "assigned" : "missing"}
              className="envios-levante-client"
            >
              <div className="envios-levante-client__who">
                <b>{s.cliente || s.orderId || "Parada"}</b>
                {s.orderId ? <span className="envios-levante-client__id">#{s.orderId}</span> : null}
                <span className={`envios-origen-chip${assigned ? "" : " is-missing"}`}>
                  {originLabelForStop(s, wizard, places) || "Sin origen"}
                </span>
              </div>
              {showSelect ? (
                <select
                  style={inp}
                  value={s.pickupPointId || ""}
                  onChange={(e) => onStopPickup?.(s.id, e.target.value)}
                  aria-label={`Origen de ${s.cliente || s.orderId || "parada"}`}
                >
                  <option value="">Elegir levante…</option>
                  {pickups.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const lbl = { display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase" };
const chipOk = {
  fontSize: 11,
  fontWeight: 700,
  color: "#166534",
  background: "#dcfce7",
  border: "1px solid #86efac",
  borderRadius: 999,
  padding: "3px 10px",
};
const chipWarn = {
  fontSize: 11,
  fontWeight: 700,
  color: "#9a3412",
  background: "#ffedd5",
  border: "1px solid #fdba74",
  borderRadius: 999,
  padding: "3px 10px",
};
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
