import { useEffect, useRef, useState } from "react";
import { ageDays, healthLevel } from "../../hooks/useAdminCotizaciones.js";

const CANAL_COLORS = {
  WA: ["#dcfce7", "#16a34a"],
  EM: ["#dbeafe", "#1d4ed8"],
  CL: ["#fef9c3", "#854d0e"],
  LO: ["#f3e8ff", "#7c3aed"],
  LL: ["#ffe4e6", "#be123c"],
  WEB: ["#e0f2fe", "#0369a1"],
};

function CanalPill({ origen }) {
  if (!origen) return null;
  const [bg, fg] = CANAL_COLORS[origen.toUpperCase()] || ["#f0f0f2", "#6e6e73"];
  return <span className="adminCot__pill" style={{ background: bg, color: fg }}>{origen}</span>;
}

function EstadoPill({ estado }) {
  const v = String(estado || "").trim();
  if (v === "Aprobado") return <span className="adminCot__pill" style={{ background: "#dcfce7", color: "#16a34a" }}>Aprobado</span>;
  if (v === "Enviado") return <span className="adminCot__pill" style={{ background: "#dbeafe", color: "#1d4ed8" }}>Enviado</span>;
  if (!v) return <span className="adminCot__pill">Pendiente</span>;
  return <span className="adminCot__pill">{v.slice(0, 14)}</span>;
}

function Kebab({ row, onApprove, onOpenPdf, onOpenReplay, onOpenSheet }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  return (
    <div className="adminCot__kebab" ref={ref}>
      <button
        type="button"
        className="adminCot__btn adminCot__btn--ghost adminCot__btn--sm"
        aria-label="Más acciones"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open && (
        <div className="adminCot__kebab-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="adminCot__kebab-item"
            disabled={row.estado === "Aprobado"}
            onClick={() => { setOpen(false); onApprove(row); }}
          >
            Aprobar respuesta
          </button>
          <button
            type="button"
            role="menuitem"
            className="adminCot__kebab-item"
            disabled={!row.link}
            onClick={() => { setOpen(false); onOpenPdf(row); }}
          >
            Abrir PDF (K)
          </button>
          <button
            type="button"
            role="menuitem"
            className="adminCot__kebab-item"
            disabled={!row.replaySnapshotUrl}
            onClick={() => { setOpen(false); onOpenReplay(row); }}
          >
            Abrir replay (M)
          </button>
          <button
            type="button"
            role="menuitem"
            className="adminCot__kebab-item"
            onClick={() => { setOpen(false); onOpenSheet(row); }}
          >
            Abrir fila en Google Sheet ↗
          </button>
        </div>
      )}
    </div>
  );
}

function ageLabel(fecha) {
  const d = ageDays(fecha);
  if (d == null) return "—";
  if (d === 0) return "hoy";
  if (d === 1) return "1d";
  return `${d}d`;
}

export default function QuotesTable({
  rows,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onMarkEnviado,
  onApprove,
  onOpenPdf,
  onOpenReplay,
  onOpenSheet,
  loading,
  emptyMessage,
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.rowNum));
  return (
    <div className="adminCot__tablewrap">
      <div className="adminCot__tablescroll">
        <table className="adminCot__table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <input
                  type="checkbox"
                  aria-label="Seleccionar todas"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                />
              </th>
              <th style={{ width: 18 }} aria-label="Estado de salud" />
              <th>Cliente</th>
              <th>Canal</th>
              <th>Fecha</th>
              <th>Consulta</th>
              <th>Estado</th>
              <th>Edad</th>
              <th style={{ width: 180 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--ac-text-2)" }}>Cargando…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--ac-text-2)" }}>{emptyMessage}</td></tr>
            )}
            {rows.map((row) => {
              const lvl = healthLevel(row.fecha, row.estado);
              const isSel = selected.has(row.rowNum);
              return (
                <tr key={row.rowNum} data-selected={isSel}>
                  <td>
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => onToggleSelect(row.rowNum)}
                      aria-label={`Seleccionar fila ${row.rowNum}`}
                    />
                  </td>
                  <td>
                    <span className="adminCot__health" data-level={lvl} aria-label={`Health ${lvl}`} />
                  </td>
                  <td>
                    <span className="adminCot__truncate" style={{ maxWidth: 180, fontWeight: 600 }}>
                      {row.cliente || "—"}
                    </span>
                  </td>
                  <td><CanalPill origen={row.origen} /></td>
                  <td style={{ color: "var(--ac-text-2)", whiteSpace: "nowrap" }}>{(row.fecha || "—").slice(0, 10)}</td>
                  <td>
                    <span
                      className="adminCot__truncate"
                      title={row.consulta}
                    >
                      {(row.consulta || "—").slice(0, 60)}{row.consulta && row.consulta.length > 60 ? "…" : ""}
                    </span>
                    {row.respuesta && row.respuesta.startsWith("⚠") && (
                      <span style={{ marginLeft: 6, color: "var(--ac-warn)" }} title={row.respuesta}>⚠</span>
                    )}
                  </td>
                  <td><EstadoPill estado={row.estado} /></td>
                  <td style={{ color: "var(--ac-text-2)", whiteSpace: "nowrap" }}>{ageLabel(row.fecha)}</td>
                  <td>
                    <div className="adminCot__rowactions">
                      <button
                        type="button"
                        className="adminCot__btn adminCot__btn--sm"
                        onClick={() => onEdit(row)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="adminCot__btn adminCot__btn--sm adminCot__btn--ghost"
                        onClick={() => onMarkEnviado(row)}
                        title="Mover a Enviados (borra del Admin)"
                      >
                        ✓ Enviado
                      </button>
                      <Kebab
                        row={row}
                        onApprove={onApprove}
                        onOpenPdf={onOpenPdf}
                        onOpenReplay={onOpenReplay}
                        onOpenSheet={onOpenSheet}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
