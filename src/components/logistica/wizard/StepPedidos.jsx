/** Step 1 — load pedidos from Ventas + list in this trip. */
import { ENV_T as T } from "../../../utils/enviosTheme.js";
import { originLabelForStop } from "../../../utils/logistica/wizardState.js";
import VentasColaCard from "../VentasColaCard.jsx";

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
 *   addingKeys?: string[],
 *   activeReparto?: object|null,
 *   wizard?: object,
 *   places?: object[],
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
  addingKeys = [],
  activeReparto = null,
  wizard = {},
  places = [],
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.4 }}>
        La cola de clientes queda abierta: tocá uno para sumarlo y seguí eligiendo. No se cierra al seleccionar.
      </p>

      <VentasColaCard
        search={search}
        onSearchChange={onSearchChange}
        onBuscar={onBuscar}
        onCargarActuales={onCargarActuales}
        loadSh={loadSh}
        shErr={shErr}
        autoLoadMsg={autoLoadMsg}
        ventasRowCount={ventasRowCount}
        results={results}
        stops={stops}
        activeReparto={activeReparto}
        onAddResult={onAddResult}
        addingKeys={addingKeys}
        onRemoveStop={onRemoveStop}
        wizard={wizard}
        places={places}
      />

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: T.brand }}>
          En este envío ({stops.length})
        </div>
        {!stops.length ? (
          <div style={{ fontSize: 12, color: T.muted }}>
            Todavía no hay pedidos. Buscá o usá <b>Cargar actuales</b> y tocá + Parada.
          </div>
        ) : (
          <ul className="envios-envio-chips" data-testid="envio-selected-clients">
            {stops.map((s) => (
              <li key={s.id} className="envios-envio-chip">
                <b>{s.cliente || "Sin nombre"}</b>
                <OrigenChip label={originLabelForStop(s, wizard, places)} />
                {typeof onRemoveStop === "function" ? (
                  <button
                    type="button"
                    onClick={() => onRemoveStop(s.id)}
                    aria-label={`Quitar ${s.cliente || s.orderId || "parada"}`}
                    className="envios-envio-chip__x"
                  >
                    ×
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

function OrigenChip({ label }) {
  const ok = Boolean(label);
  return (
    <span className={`envios-origen-chip${ok ? "" : " is-missing"}`} data-testid="origen-chip">
      {ok ? label : "Sin origen"}
    </span>
  );
}
