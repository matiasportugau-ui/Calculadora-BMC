import Tooltip from "../help/Tooltip.jsx";
import { HELP_ANCHORS } from "../help/anchors.js";

function Stat({ label, value, variant }) {
  const cls = `adminCot__stat${variant ? ` adminCot__stat--${variant}` : ""}`;
  return (
    <div className={cls}>
      <span className="adminCot__stat-label">{label}</span>
      <span className="adminCot__stat-value">{value}</span>
    </div>
  );
}

export default function StatStrip({ stats }) {
  const { pendientes, aprobadas, conError, edadAlta } = stats;
  return (
    <section className="adminCot__stats" aria-label="Indicadores">
      <Tooltip id={HELP_ANCHORS.KPI_PENDIENTES}>
        <Stat label="Pendientes" value={pendientes} />
      </Tooltip>
      <Tooltip id={HELP_ANCHORS.KPI_APROBADAS}>
        <Stat label="Aprobadas" value={aprobadas} variant="success" />
      </Tooltip>
      <Tooltip id={HELP_ANCHORS.KPI_ERROR}>
        <Stat label="Con error ⚠" value={conError} variant={conError > 0 ? "warn" : undefined} />
      </Tooltip>
      <Tooltip id={HELP_ANCHORS.KPI_STALE}>
        <Stat label="≥14 días sin enviar" value={edadAlta} variant={edadAlta > 0 ? "error" : undefined} />
      </Tooltip>
    </section>
  );
}
