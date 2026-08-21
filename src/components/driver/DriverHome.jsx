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
  const name = profile.name || plan.info?.chofer_name || "chofer";
  const first = stops[0];
  const last = stops[stops.length - 1];
  const from = first?.direccion || first?.cliente || plan.info?.pickup_label || "Carga";
  const to = last?.direccion || last?.cliente || "Entrega";
  const recent = [...(timeline || [])].reverse().slice(0, 6);

  return (
    <div className="drv-scroll">
      <h1 className="drv-h1">Hola {name}</h1>
      <p className="drv-sub">Listo para un nuevo viaje</p>
      {(!online || pendingCount > 0) && (
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
          <strong>Viaje en curso</strong>
          <span style={{ color: "#f15a24", fontSize: 12 }}>{trip?.status || "—"}</span>
        </div>
        <p style={{ margin: "10px 0 4px" }}>
          <span className="drv-muted">De</span> {from}
        </p>
        <p style={{ margin: "0 0 10px" }}>
          <span className="drv-muted">A</span> {to}
        </p>
        <p className="drv-muted">{stops.length} parada(s) · {plan.reparto_no || trip?.trip_id?.slice(0, 8)}</p>
        <button type="button" className="drv-cta drv-cta--orange" onClick={onGoCarga}>
          Continuar viaje
        </button>
      </div>
      <h2 style={{ fontSize: 15, margin: "8px 0" }}>Acciones rápidas</h2>
      <div className="drv-quick">
        <button type="button" onClick={onGoCarga}>
          Mis rutas
        </button>
        <button type="button" disabled>
          Carga 3D
        </button>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          Remitos
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onEvidence(f);
            }}
          />
        </label>
        <button type="button" disabled>
          Mapa
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
