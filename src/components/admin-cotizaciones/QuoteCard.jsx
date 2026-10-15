import {
  alertaLabel,
  alertaLevel,
  antiguedadLabel,
  prioridadFromRow,
} from "../../hooks/useAdminCotizaciones.js";
import { suggestOwner, operatorLabel } from "../../utils/cotizacionAssignment.js";

export default function QuoteCard({ row, selected, onToggleSelect, onEdit, onMarkEnviado }) {
  const lvl = alertaLevel(row.fecha, row.estado);
  const suggested = suggestOwner({ origen: row.origen, consulta: row.consulta });
  const isCrmOnly = row.source && row.source !== "admin";
  return (
    <article className="adminCot__qcard" data-selected={selected} style={isCrmOnly ? { opacity: 0.85 } : undefined}>
      <div className="adminCot__qcard-row">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isCrmOnly && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(row.rowNum)}
              aria-label={`Seleccionar fila ${row.rowNum}`}
            />
          )}
          <span className="adminCot__health" data-level={lvl} title={alertaLabel(lvl)} />
          <strong>{row.cliente || "—"}</strong>
          {isCrmOnly && (
            <span
              className="adminCot__pill"
              title={`Fila desde CRM_Operativo. Acciones limitadas. Source: ${row.source}`}
              style={{ marginLeft: 4, background: "#f3e8ff", color: "#7c3aed", fontSize: 10 }}
            >
              CRM
            </span>
          )}
        </label>
        <span className="adminCot__pill">{row.origen || "—"}</span>
      </div>

      <div className="adminCot__qcard-meta">
        {(row.fecha || "—").slice(0, 10)} · Antigüedad {antiguedadLabel(row.fecha)} · Alerta {alertaLabel(lvl)} · Prioridad {prioridadFromRow(row)} · Estado: <strong>{row.estado || "Pendiente"}</strong>
        {" · "}
        <span title={`Sugerencia automática: ${operatorLabel(suggested)} (${suggested}) · podés sobrescribir`}>
          💡 {operatorLabel(suggested)}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: "var(--ac-text)" }}>
        {(row.consulta || "—").slice(0, 140)}{row.consulta && row.consulta.length > 140 ? "…" : ""}
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="adminCot__btn adminCot__btn--sm"
          onClick={() => onEdit(row)}
          title={isCrmOnly ? "Abrir detalle (read-only para filas CRM)" : "Editar fila"}
        >
          Editar
        </button>
        <button
          type="button"
          className="adminCot__btn adminCot__btn--sm adminCot__btn--ghost"
          onClick={() => onMarkEnviado(row)}
          disabled={isCrmOnly}
          title={isCrmOnly
            ? "Esta fila vive en CRM_Operativo — usá el panel /hub/ml para marcar enviada"
            : "Mover a Enviados"}
        >
          ✓ Enviado
        </button>
        {row.link && (
          <a href={row.link} target="_blank" rel="noopener noreferrer" className="adminCot__btn adminCot__btn--sm adminCot__btn--ghost">
            PDF ↗
          </a>
        )}
      </div>
    </article>
  );
}
