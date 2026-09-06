import { useRef } from "react";
import { projectDriverTripFeed } from "../../utils/logistica/driverTripFeed.js";

export default function DriverTripDone({ stops, timeline, plan, trip, onHome, onEvidence }) {
  const evidence = (timeline || []).filter((e) => e.event_type === "evidence_committed").length;
  const incidents = (timeline || []).filter((e) => e.event_type === "incident_reported").length;
  const km = Number(plan.trip_km || plan.info?.km || 0);
  const remitosRef = useRef(null);
  const feed = projectDriverTripFeed({ trip, plan, stops });

  return (
    <div className="drv-scroll">
      {feed.remito ? <p className="drv-kicker">{feed.remito} / RESUMEN</p> : null}
      <div className="drv-card" style={{ textAlign: "center" }}>
        <div className="drv-dot drv-dot--done" style={{ margin: "0 auto 12px", width: 48, height: 48, fontSize: 22 }}>
          ✓
        </div>
        <h1 className="drv-h1" style={{ color: "#22c55e" }}>
          Viaje completado
        </h1>
        <p className="drv-sub">Gracias por completar tu entrega.</p>
        <div className="drv-stats">
          <div>
            <strong>{feed.stopCount || stops.length}</strong>
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
        {(stops.length ? stops : []).map((s) => (
          <div className="drv-step" key={s.id}>
            <div className="drv-dot drv-dot--done">✓</div>
            <div>
              <div>{s.cliente || "Parada"}</div>
              <div className="drv-muted">{s.direccion || ""}</div>
            </div>
          </div>
        ))}
        {!stops.length && <p className="drv-muted">Sin paradas en el viaje asignado.</p>}
      </div>
      <button type="button" className="drv-cta drv-cta--blue" onClick={() => remitosRef.current?.click()}>
        Ver remitos
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
          if (f && onEvidence) onEvidence(f);
          e.target.value = "";
        }}
      />
      <button type="button" className="drv-cta drv-cta--ghost" onClick={onHome}>
        Nueva ruta
      </button>
      <p className="drv-muted" style={{ textAlign: "center" }}>
        BMC URUGUAY · BUEN TRABAJO
      </p>
    </div>
  );
}
