import { ageDays, healthLevel } from "../../hooks/useAdminCotizaciones.js";

function ageLabel(fecha) {
  const d = ageDays(fecha);
  if (d == null) return "—";
  if (d === 0) return "hoy";
  return `${d}d`;
}

export default function QuoteCard({ row, selected, onToggleSelect, onEdit, onMarkEnviado }) {
  const lvl = healthLevel(row.fecha, row.estado);
  return (
    <article className="adminCot__qcard" data-selected={selected}>
      <div className="adminCot__qcard-row">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(row.rowNum)}
            aria-label={`Seleccionar fila ${row.rowNum}`}
          />
          <span className="adminCot__health" data-level={lvl} />
          <strong>{row.cliente || "—"}</strong>
        </label>
        <span className="adminCot__pill">{row.origen || "—"}</span>
      </div>

      <div className="adminCot__qcard-meta">
        {(row.fecha || "—").slice(0, 10)} · {ageLabel(row.fecha)} · Estado: <strong>{row.estado || "Pendiente"}</strong>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: "var(--ac-text)" }}>
        {(row.consulta || "—").slice(0, 140)}{row.consulta && row.consulta.length > 140 ? "…" : ""}
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="adminCot__btn adminCot__btn--sm" onClick={() => onEdit(row)}>
          Editar
        </button>
        <button
          type="button"
          className="adminCot__btn adminCot__btn--sm adminCot__btn--ghost"
          onClick={() => onMarkEnviado(row)}
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
