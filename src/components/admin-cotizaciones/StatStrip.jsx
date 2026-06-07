import Tooltip from "../help/Tooltip.jsx";
import { HELP_ANCHORS } from "../help/anchors.js";

function Stat({ label, value, variant, 'data-tutorial-id': tutorialId }) {
  const cls = `adminCot__stat${variant ? ` adminCot__stat--${variant}` : ""}`;
  return (
    <div className={cls} data-tutorial-id={tutorialId}>
      <span className="adminCot__stat-label">{label}</span>
      <span className="adminCot__stat-value">{value}</span>
    </div>
  );
}

export default function StatStrip({ stats }) {
  const { pendientes, borrador, revision, aprobadas, enviadas, conError, urgentes } = stats;
  return (
    <section className="adminCot__stats" aria-label="Indicadores del pipeline de leads">
      <Tooltip id={HELP_ANCHORS.KPI_PENDIENTES}>
        <Stat label="Pendientes" value={pendientes} data-tutorial-id="kpi-pendientes" />
      </Tooltip>
      <Stat label="Borrador" value={borrador} variant={borrador > 0 ? "info" : undefined} />
      <Stat label="En Revisión" value={revision} variant={revision > 0 ? "warn" : undefined} />
      <Tooltip id={HELP_ANCHORS.KPI_APROBADAS}>
        <Stat label="Aprobadas" value={aprobadas} variant="success" />
      </Tooltip>
      <Stat label="Enviadas" value={enviadas} />
      <Tooltip id={HELP_ANCHORS.KPI_ERROR}>
        <Stat label="Error ⚠" value={conError} variant={conError > 0 ? "warn" : undefined} data-tutorial-id="kpi-error" />
      </Tooltip>
      <Tooltip id={HELP_ANCHORS.KPI_STALE}>
        <Stat label="Urgentes (7d+)" value={urgentes} variant={urgentes > 0 ? "error" : undefined} data-tutorial-id="kpi-stale" />
      </Tooltip>
    </section>
  );
}
