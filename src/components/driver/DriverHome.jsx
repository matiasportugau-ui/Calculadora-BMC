import { useRef } from "react";
import { projectDriverTripFeed } from "../../utils/logistica/driverTripFeed.js";

export default function DriverHome({
  profile,
  trip,
  plan,
  stops,
  timeline,
  pendingCount,
  online,
  status,
  onSync,
  onGoCarga,
  onEvidence,
}) {
  const remitosRef = useRef(null);
  const name = profile.name || plan.info?.chofer_name || "chofer";
  const feed = projectDriverTripFeed({ trip, plan, stops });
  const from = feed.origin || (feed.demo ? "" : "—");
  const to = feed.dest || (feed.demo ? "" : "—");
  const recent = [...(timeline || [])].reverse().slice(0, 6);

  return (
    <div className="drv-scroll">
      <p className="drv-kicker">BMC DRIVER</p>
      <h1 className="drv-h1">Hola, {name}</h1>
      <p className="drv-sub">Tu viaje de hoy, en un solo lugar.</p>
      {online && pendingCount === 0 ? (
        <div className="drv-banner drv-banner--ok">En línea · Todo sincronizado</div>
      ) : (
        <div className="drv-banner">
          Modo sin conexión
          <div>
            {pendingCount > 0
              ? `${pendingCount} evento(s) pendientes`
              : "Trabajando sin conexión a internet"}
          </div>
          {pendingCount > 0 && (
            <button type="button" className="drv-cta drv-cta--orange" onClick={onSync}>
              Sincronizar
            </button>
          )}
        </div>
      )}
      {status ? <p className="drv-danger">{status}</p> : null}
      <div className="drv-card">
        <div className="drv-row" style={{ justifyContent: "space-between" }}>
          <strong>VIAJE EN CURSO</strong>
          <span style={{ color: "#f15a24", fontSize: 12 }}>{trip?.status || "—"}</span>
        </div>
        {feed.demo ? (
          <p className="drv-muted">Sin viaje asignado. El operador confirma la ruta en Logística.</p>
        ) : (
          <>
            <p style={{ margin: "10px 0 4px", fontSize: 22, fontWeight: 700 }}>
              {from} → {to}
            </p>
            <p className="drv-muted">
              {feed.remito || trip?.trip_id?.slice(0, 8)} · {feed.stopCount} parada(s)
              {feed.qty > 0 ? ` · ${feed.qty} paneles` : ""}
            </p>
          </>
        )}
        {feed.demo ? (
          <button type="button" className="drv-cta drv-cta--orange" disabled>
            Sin viaje asignado
          </button>
        ) : (
          <button type="button" className="drv-cta drv-cta--orange" onClick={onGoCarga}>
            Continuar viaje
          </button>
        )}
      </div>
      <h2 style={{ fontSize: 15, margin: "8px 0" }}>Acciones rápidas</h2>
      <div className="drv-quick">
        <button type="button" onClick={onGoCarga} disabled={feed.demo}>
          Mis rutas
        </button>
        <button type="button" onClick={() => remitosRef.current?.click()}>
          Remitos
        </button>
        <input
          ref={remitosRef}
          className="drv-file-hidden"
          type="file"
          accept="image/*"
          capture="environment"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onEvidence(f);
            e.target.value = "";
          }}
        />
        <button type="button" disabled className="drv-quick--soon" title="Próximamente">
          Carga 3D
          <span>Próximamente</span>
        </button>
        <button type="button" disabled className="drv-quick--soon" title="Próximamente">
          Mapa
          <span>Próximamente</span>
        </button>
      </div>
      <h2 style={{ fontSize: 15, margin: "16px 0 8px" }}>Actividad reciente</h2>
      <div className="drv-card">
        {recent.length === 0 && <p className="drv-muted">Todavía no hay eventos.</p>}
        {recent.map((ev, i) => (
          <div key={i} className="drv-step" style={{ padding: "8px 0" }}>
            <div>
              <strong>{labelEvent(ev.event_type)}</strong>
              <div className="drv-muted">{ev.at_server}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function labelEvent(type) {
  const map = {
    factory_arrived: "Llegué a fábrica",
    load_started: "Inicié carga",
    load_completed: "Carga lista",
    factory_departed: "Salí de fábrica",
    stop_arrived: "Llegué a parada",
    delivery_completed: "Entregado",
    incident_reported: "Incidencia",
    evidence_committed: "Remito / foto",
    trip_assigned: "Nuevo viaje asignado",
    location_ping: "GPS",
  };
  return map[type] || type;
}
