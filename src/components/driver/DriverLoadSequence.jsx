const STEPS = [
  { n: 1, type: "factory_arrived", label: "Llegué a fábrica" },
  { n: 2, type: "load_started", label: "Inicié carga" },
  { n: 3, type: "load_completed", label: "Carga lista" },
  { n: 4, type: "factory_departed", label: "Salí de fábrica" },
];

export default function DriverLoadSequence({
  phase,
  plan,
  stops,
  sendEvent,
  onAfterDepart,
}) {
  const current = STEPS[Math.min(phase, 3)];
  const info = plan.info || {};
  const dest = stops[stops.length - 1];
  const qty = stops.reduce((n, s) => n + Number(s.qty || s.cantidad || 0), 0);

  if (phase >= 4) {
    return (
      <div className="drv-scroll">
        <h1 className="drv-h1">Entregas</h1>
        <p className="drv-sub">Marcá llegada y entrega en cada parada</p>
        {stops.map((s) => (
          <div className="drv-card" key={s.id}>
            <strong>{s.cliente || "Parada"}</strong>
            <p className="drv-muted">{s.direccion || s.orderId || ""}</p>
            <button
              type="button"
              className="drv-cta drv-cta--navy"
              onClick={() => sendEvent("stop_arrived", {}, null, s.id)}
            >
              Llegué
            </button>
            <button
              type="button"
              className="drv-cta drv-cta--orange"
              onClick={() => sendEvent("delivery_completed", {}, null, s.id)}
            >
              Entregado
            </button>
          </div>
        ))}
        <button type="button" className="drv-cta drv-cta--ghost" onClick={onAfterDepart}>
          Ver resumen
        </button>
      </div>
    );
  }

  return (
    <div className="drv-scroll">
      <h1 className="drv-h1">Carga en fábrica</h1>
      <p className="drv-sub">Seguí los pasos en orden</p>
      <div className="drv-card">
        <strong>Secuencia de carga</strong>
        {STEPS.map((st) => {
          const done = phase >= st.n;
          const now = phase + 1 === st.n;
          return (
            <div className="drv-step" key={st.type}>
              <div className={`drv-dot ${done ? "drv-dot--done" : now ? "drv-dot--now" : "drv-dot--wait"}`}>
                {done ? "✓" : st.n}
              </div>
              <div style={{ flex: 1 }}>
                <div>{st.label}</div>
                <div className="drv-muted">
                  {done ? "Completado" : now ? "En progreso" : "Pendiente"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="drv-card">
        <strong>Resumen de carga</strong>
        <p>
          Tipo: {info.producto || "Paneles BMC"} · Destino: {dest?.cliente || dest?.direccion || "—"}
        </p>
        {qty > 0 && <p className="drv-muted">Cantidad {qty}</p>}
      </div>
      <p className="drv-muted">Seguridad primero · Usá EPP en fábrica.</p>
      <button
        type="button"
        className="drv-cta drv-cta--orange"
        onClick={() => sendEvent(current.type)}
      >
        {current.label}
      </button>
    </div>
  );
}
