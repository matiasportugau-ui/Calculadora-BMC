import { cargaFactoryView } from "../../utils/logistica/cargaFactoryStep.js";
import { projectDriverTripFeed } from "../../utils/logistica/driverTripFeed.js";

export default function DriverLoadSequence({
  timeline,
  plan,
  stops,
  sendEvent,
  onAfterDepart,
}) {
  const view = cargaFactoryView(timeline);
  const feed = projectDriverTripFeed({ plan, stops });
  const dest = feed.dest || "—";

  if (view.complete) {
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
      {feed.remito ? <p className="drv-kicker">{feed.remito} / {feed.origin} → {feed.dest}</p> : null}
      <h1 className="drv-h1">Carga en fábrica</h1>
      <p className="drv-sub">Seguí los pasos en orden.</p>
      <div className="drv-card">
        <div className="drv-row" style={{ justifyContent: "space-between" }}>
          <strong>Secuencia de carga</strong>
          <span className="drv-muted">{view.counter}</span>
        </div>
        {view.steps.map((st) => (
          <div className="drv-step" key={st.type}>
            <div className={`drv-dot ${st.done ? "drv-dot--done" : st.current ? "drv-dot--now" : "drv-dot--wait"}`}>
              {st.done ? "✓" : st.n}
            </div>
            <div style={{ flex: 1 }}>
              <div>{st.label}</div>
              <div className="drv-muted">{st.status}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="drv-card">
        <strong>Resumen de carga</strong>
        <p>
          {plan.info?.producto || "Paneles BMC"}
          {feed.qty > 0 ? ` · ${feed.qty} unidades` : ""}
        </p>
        <p className="drv-muted">Destino final · {dest}</p>
      </div>
      <p className="drv-muted">Seguridad primero · Usá EPP en fábrica.</p>
      <button
        type="button"
        className="drv-cta drv-cta--orange"
        onClick={() => sendEvent(view.eventType)}
      >
        {view.cta}
      </button>
    </div>
  );
}
