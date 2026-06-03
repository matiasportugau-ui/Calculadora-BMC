import { useEffect, useMemo, useRef, useState } from "react";
import { ageDays, healthLevel } from "../../hooks/useAdminCotizaciones.js";

function SelectAllCheckbox({ allSelected, someSelected, onToggle }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !allSelected && someSelected;
  }, [allSelected, someSelected]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Seleccionar todas"
      aria-checked={allSelected ? "true" : (someSelected ? "mixed" : "false")}
      checked={allSelected}
      onChange={onToggle}
    />
  );
}

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
  const v = String(estado || "").trim().toLowerCase();

  if (v.includes("aprobado") || v === "aprobado oficial") {
    return <span className="adminCot__pill" style={{ background: "#dcfce7", color: "#166534", fontWeight: 600 }}>Aprobado</span>;
  }
  if (v.includes("enviado")) {
    return <span className="adminCot__pill" style={{ background: "#dbeafe", color: "#1e40af" }}>Enviado</span>;
  }
  if (v.includes("borrador")) {
    return <span className="adminCot__pill" style={{ background: "#fef3c7", color: "#92400e" }}>Borrador</span>;
  }
  if (v.includes("revis")) {
    return <span className="adminCot__pill" style={{ background: "#e0e7ff", color: "#3730a3" }}>En Revisión</span>;
  }
  if (v.includes("asignad")) {
    return <span className="adminCot__pill" style={{ background: "#f3e8ff", color: "#6b21a8" }}>Asignado</span>;
  }
  if (!v || v === "pendiente") {
    return <span className="adminCot__pill" style={{ background: "#f1f5f9", color: "#475569" }}>Pendiente</span>;
  }
  // Fallback for other states (e.g. Rechazado, Error, etc.)
  return <span className="adminCot__pill" style={{ background: "#fee2e2", color: "#991b1b" }}>{String(estado).slice(0, 14)}</span>;
}

function Kebab({ row, onApprove, onOpenPdf, onOpenReplay, onOpenSheet, onOpenBorrador }) {
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

          {/* Tanda 1 - Borrador integration */}
          {row.borradorPdf || row.borradorExplicacion ? (
            <button
              type="button"
              role="menuitem"
              className="adminCot__kebab-item"
              onClick={() => { setOpen(false); onOpenBorrador?.(row); }}
            >
              Ver Borrador (PDF / Explicación)
            </button>
          ) : null}
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
  onOpenBorrador,
  onQuickAssign,
  loading,
  emptyMessage,
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.rowNum));
  const someSelected = useMemo(
    () => rows.some((r) => selected.has(r.rowNum)),
    [rows, selected],
  );
  return (
    <div className="adminCot__tablewrap" data-tutorial-id="quotes-table">
      <div className="adminCot__tablescroll">
        <table className="adminCot__table">
          <thead>
            <tr>
              <th style={{ width: 36 }}>
                <SelectAllCheckbox
                  allSelected={allSelected}
                  someSelected={someSelected}
                  onToggle={onToggleSelectAll}
                />
              </th>
              <th style={{ width: 18 }} aria-label="Estado de salud" />
              <th>Cliente</th>
              <th>Canal</th>
              <th>Fecha</th>
              <th>Consulta</th>
              <th>Estado</th>
              <th>Responsable</th>
              <th>Edad</th>
              <th style={{ width: 220 }}>Acciones</th>
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
              const isCrmOnly = row.source && row.source !== "admin";
              const isSel = !isCrmOnly && selected.has(row.rowNum);
              const rowKey = row.rowNum ?? `crm-${row.source || "x"}-${row.crmRow ?? row.id ?? "?"}`;
              return (
                <tr key={rowKey} data-selected={isSel} style={isCrmOnly ? { background: "var(--ac-surface-2, rgba(0,0,0,0.02))" } : undefined}>
                  <td>
                    {!isCrmOnly && (
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => onToggleSelect(row.rowNum)}
                        aria-label={`Seleccionar fila ${row.rowNum}`}
                      />
                    )}
                  </td>
                  <td>
                    <span className="adminCot__health" data-level={lvl} aria-label={`Health ${lvl}`} />
                  </td>
                  <td>
                    <span className="adminCot__truncate" style={{ maxWidth: 180, fontWeight: 600 }}>
                      {row.cliente || "—"}
                    </span>
                    {isCrmOnly && (
                      <span
                        className="adminCot__pill"
                        title={`Fila viene de CRM_Operativo (no del Admin 2.0). Las acciones de Enviado / Aprobar viven en el panel /hub/ml. Source: ${row.source}`}
                        style={{ marginLeft: 6, background: "#f3e8ff", color: "#7c3aed", fontSize: 10 }}
                      >
                        CRM
                      </span>
                    )}
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
                        title={isCrmOnly ? "Abrir detalle (read-only para filas CRM)" : "Editar fila"}
                      >
                        Editar
                      </button>

                      {/* Tanda 1 - Aggressive quick actions for best lead management */}
                      {!isCrmOnly && onQuickAssign && (
                        <button
                          type="button"
                          className="adminCot__btn adminCot__btn--sm"
                          style={{ background: "#f3e8ff", color: "#6b21a8" }}
                          onClick={() => onQuickAssign(row)}
                          title="Asignar responsable rápido"
                        >
                          Asignar
                        </button>
                      )}

                      {(row.borradorPdf || row.borradorExplicacion) && onOpenBorrador && (
                        <button
                          type="button"
                          className="adminCot__btn adminCot__btn--sm"
                          style={{ background: "#fef3c7", color: "#92400e" }}
                          onClick={() => onOpenBorrador(row)}
                          title="Ver Borrador generado por el flujo híbrido"
                        >
                          📄 Borrador
                        </button>
                      )}

                      <button
                        type="button"
                        className="adminCot__btn adminCot__btn--sm adminCot__btn--ghost"
                        onClick={() => onMarkEnviado(row)}
                        disabled={isCrmOnly}
                        title={isCrmOnly
                          ? "Esta fila vive en CRM_Operativo — usá el panel /hub/ml para marcar enviada"
                          : "Mover a Enviados (borra del Admin)"}
                      >
                        ✓ Enviado
                      </button>

                      {!isCrmOnly && (
                        <Kebab
                          row={row}
                          onApprove={onApprove}
                          onOpenPdf={onOpenPdf}
                          onOpenReplay={onOpenReplay}
                          onOpenSheet={onOpenSheet}
                          onOpenBorrador={onOpenBorrador}
                        />
                      )}
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
