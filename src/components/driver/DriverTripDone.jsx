export default function DriverTripDone({ stops, timeline, plan, onHome }) {
  const evidence = (timeline || []).filter((e) => e.event_type === "evidence_committed").length;
  const incidents = (timeline || []).filter((e) => e.event_type === "incident_reported").length;
  const km = Number(plan.trip_km || plan.info?.km || 0);

  return (
    <div className="drv-scroll">
      <div className="drv-card" style={{ textAlign: "center" }}>
        <div className="drv-dot drv-dot--done" style={{ margin: "0 auto 12px", width: 48, height: 48, fontSize: 22 }}>
          ✓
        </div>
        <h1 className="drv-h1" style={{ color: "#22c55e" }}>
          Viaje completado
        </h1>
        <p className="drv-sub">Gracias por completar tu entrega</p>
        <div className="drv-stats">
          <div>
            <strong>{stops.length}</strong>
            <span>paradas</span>
          </div>
          <div>
            <strong>{km ? km.toFixed(1) : "—"}</strong>
            <span>km</span>
          </div>
          <div>
            <strong>{evidence}</strong>
            <span>remitos</span>
          </div>
          <div>
            <strong>{incidents}</strong>
            <span>incidencias</span>
          </div>
        </div>
      </div>
      <div className="drv-card">
        <strong>Resumen de paradas</strong>
        {(stops.length ? stops : [{ cliente: "Viaje", id: "x" }]).map((s) => (
          <div className="drv-step" key={s.id}>
            <div className="drv-dot drv-dot--done">✓</div>
            <div>
              <div>{s.cliente || "Parada"}</div>
              <div className="drv-muted">{s.direccion || ""}</div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="drv-cta drv-cta--blue" onClick={onHome}>
        Ver remitos / inicio
      </button>
      <button type="button" className="drv-cta drv-cta--ghost" onClick={onHome}>
        Nueva ruta
      </button>
      <p className="drv-muted" style={{ textAlign: "center" }}>
        BMC Fleet Command
      </p>
    </div>
  );
}
