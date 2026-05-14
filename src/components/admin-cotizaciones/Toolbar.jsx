import { useState } from "react";
import Tooltip from "../help/Tooltip.jsx";
import HelpButton from "../help/HelpButton.jsx";
import FirstTimeTip from "../help/FirstTimeTip.jsx";
import { HELP_ANCHORS } from "../help/anchors.js";

const STATUS_OPTIONS = [
  { id: "todas", label: "Todas" },
  { id: "pendientes", label: "Pendientes" },
  { id: "aprobadas", label: "Aprobadas" },
  { id: "error", label: "Con error" },
  { id: "atrasadas", label: "+14d" },
];

const MANUAL_ORIGEN_OPTIONS = [
  { id: "CL", label: "CL · Cliente físico" },
  { id: "LL", label: "LL · Llamada" },
  { id: "LO", label: "LO · Local / oficina" },
  { id: "FB", label: "FB · Facebook" },
  { id: "IG", label: "IG · Instagram" },
];

const EMPTY_NUEVA = { origen: "LL", cliente: "", telefono: "", zona: "", consulta: "" };

function NuevaConsultaModal({ onClose, onConfirm, busy }) {
  const [form, setForm] = useState(EMPTY_NUEVA);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const consultaTrim = String(form.consulta || "").trim();
  const canSubmit = !busy && consultaTrim.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    const { ok } = await onConfirm(form);
    if (ok) onClose();
  };

  return (
    <div className="adminCot__modal-backdrop" role="dialog" aria-modal="true" aria-label="Nueva consulta manual">
      <div className="adminCot__modal">
        <div className="adminCot__modal-header">
          <strong>+ Nueva consulta manual</strong>
          <button type="button" className="adminCot__btn adminCot__btn--ghost adminCot__btn--sm" onClick={onClose}>✕</button>
        </div>
        <div className="adminCot__modal-body">
          <p style={{ margin: 0, fontSize: 12, color: "var(--ac-text-2)", lineHeight: 1.5 }}>
            Para canales que no entran automáticamente al Admin 2.0 (in-person, llamadas, redes sociales).
            La fila se agrega al final con Estado=<code>Pendiente</code> y un ID <code>MAN-…</code> para correlación.
          </p>

          <label className="adminCot__check" style={{ display: "block", marginBottom: 8 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Origen</span>
            <select
              className="adminCot__input"
              value={form.origen}
              onChange={(e) => set("origen", e.target.value)}
              disabled={busy}
              style={{ width: "100%" }}
            >
              {MANUAL_ORIGEN_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="adminCot__check" style={{ display: "block", marginBottom: 8 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Cliente</span>
            <input
              type="text"
              className="adminCot__input"
              value={form.cliente}
              onChange={(e) => set("cliente", e.target.value)}
              placeholder="Nombre o referencia"
              disabled={busy}
              style={{ width: "100%" }}
            />
          </label>

          <label className="adminCot__check" style={{ display: "block", marginBottom: 8 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Teléfono</span>
            <input
              type="tel"
              className="adminCot__input"
              value={form.telefono}
              onChange={(e) => set("telefono", e.target.value)}
              placeholder="099 123 456 · opcional"
              disabled={busy}
              style={{ width: "100%" }}
            />
          </label>

          <label className="adminCot__check" style={{ display: "block", marginBottom: 8 }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Zona / dirección</span>
            <input
              type="text"
              className="adminCot__input"
              value={form.zona}
              onChange={(e) => set("zona", e.target.value)}
              placeholder="Maldonado · Pando · etc. · opcional"
              disabled={busy}
              style={{ width: "100%" }}
            />
          </label>

          <label className="adminCot__check" style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Consulta <span style={{ color: "var(--ac-error, #c33)" }}>*</span>
            </span>
            <textarea
              className="adminCot__textarea"
              value={form.consulta}
              onChange={(e) => set("consulta", e.target.value)}
              rows={4}
              placeholder="Lo que pidió el cliente — ej: Isodec 100mm / 4p de 6m / completo + flete"
              disabled={busy}
            />
          </label>
        </div>
        <div className="adminCot__modal-footer">
          <button type="button" className="adminCot__btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button
            type="button"
            className="adminCot__btn adminCot__btn--primary"
            onClick={submit}
            disabled={!canSubmit}
            title={consultaTrim ? "Crear fila pendiente" : "Falta la consulta"}
          >
            {busy ? "Creando…" : "Crear pendiente"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Fully controlled — reads from `opts` and writes via `onChange`. This means
// edits and the "Defaults del servidor" button persist immediately to
// localStorage via the parent's updateBatchOpts/resetBatchOpts.
function BatchModal({ opts, onChange, onClose, onConfirm, onResetDefaults }) {
  const set = (k, v) => onChange({ ...opts, [k]: v });
  return (
    <div className="adminCot__modal-backdrop" role="dialog" aria-modal="true" aria-label="Generar IA en lote">
      <div className="adminCot__modal">
        <div className="adminCot__modal-header">
          <strong>Generar IA en lote</strong>
          <button type="button" className="adminCot__btn adminCot__btn--ghost adminCot__btn--sm" onClick={onClose}>✕</button>
        </div>
        <div className="adminCot__modal-body">
          <p style={{ margin: 0, fontSize: 12, color: "var(--ac-text-2)", lineHeight: 1.5 }}>
            <code>POST /api/wolfboard/quote-batch</code>. El servidor procesa todas las filas con consulta (I)
            que aún no tengan respuesta en J (o que tengan ⚠ si activás &ldquo;Forzar&rdquo;).
          </p>
          <label className="adminCot__check">
            <input type="checkbox" checked={opts.force} onChange={(e) => set("force", e.target.checked)} />
            <span>
              <strong>Forzar reprocesar</strong> filas con ⚠
              <em>Sin esta flag, solo entran filas con J vacío.</em>
            </span>
          </label>
          <label className="adminCot__check">
            <input type="checkbox" checked={opts.syncToCrm} onChange={(e) => set("syncToCrm", e.target.checked)} />
            <span>
              <strong>Sincronizar con CRM</strong>
              <em>Lee CRM y propaga AF (respuesta) y AH (link).</em>
            </span>
          </label>
          <label className="adminCot__check" style={{ opacity: opts.syncToCrm ? 1 : 0.55 }}>
            <input type="checkbox" checked={opts.createCrmRows} onChange={(e) => set("createCrmRows", e.target.checked)} disabled={!opts.syncToCrm} />
            <span>
              <strong>Crear fila nueva en CRM</strong>
              <em>Si no hay match (solo en CRM_Operativo).</em>
            </span>
          </label>
          <label className="adminCot__check" style={{ opacity: opts.syncToCrm ? 1 : 0.55 }}>
            <input type="checkbox" checked={opts.syncQuoteLink} onChange={(e) => set("syncQuoteLink", e.target.checked)} disabled={!opts.syncToCrm} />
            <span>
              <strong>Escribir link de presupuesto</strong>
              <em>Columna AH cuando hay link generado.</em>
            </span>
          </label>
        </div>
        <div className="adminCot__modal-footer">
          <button type="button" className="adminCot__btn adminCot__btn--ghost" onClick={onResetDefaults}>
            Defaults del servidor
          </button>
          <button type="button" className="adminCot__btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="adminCot__btn adminCot__btn--primary" onClick={() => { onConfirm(opts); onClose(); }}>
            Ejecutar batch
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Toolbar({
  scope, setScope,
  statusFilter, setStatusFilter,
  search, setSearch,
  selectedCount,
  loading, busyOp,
  rowCount, sheetRowCount,
  onRefresh,
  onRunSync,
  onRunBatch,
  onCreateRow,
  exportCsvHref,
  batchOpts,
  updateBatchOpts,
  onResetBatchOpts,
  onMarkSelectedEnviados,
}) {
  const [batchOpen, setBatchOpen] = useState(false);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  return (
    <>
      <div className="adminCot__toolbar" role="toolbar" aria-label="Acciones globales">
        <input
          type="search"
          className="adminCot__search"
          placeholder="Buscar cliente, consulta o teléfono…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Buscar"
        />

        <div className="adminCot__pillgroup" role="group" aria-label="Alcance">
          <button
            type="button"
            className="adminCot__pill"
            aria-pressed={scope === "consulta"}
            onClick={() => setScope("consulta")}
          >
            Con consulta
          </button>
          <button
            type="button"
            className="adminCot__pill"
            aria-pressed={scope === "admin"}
            onClick={() => setScope("admin")}
          >
            Toda la planilla
          </button>
          <HelpButton id={HELP_ANCHORS.TOOLBAR_SCOPE} label="Sobre el alcance" />
        </div>

        <div className="adminCot__pillgroup" role="group" aria-label="Estado">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className="adminCot__pill"
              aria-pressed={statusFilter === o.id}
              onClick={() => setStatusFilter(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
          {onCreateRow && (
            <button
              type="button"
              className="adminCot__btn"
              onClick={() => setNuevaOpen(true)}
              disabled={busyOp === "create"}
              title="Cargar manualmente una consulta de llamada, in-person, o redes sociales"
            >
              + Nueva consulta
            </button>
          )}
          <span style={{ position: "relative", display: "inline-block" }}>
            <button
              type="button"
              className="adminCot__btn adminCot__btn--primary"
              onClick={() => setBatchOpen(true)}
              disabled={busyOp === "batch"}
            >
              ✦ Generar IA
            </button>
            <FirstTimeTip id={HELP_ANCHORS.TOOLBAR_BATCH_GENERATE} placement="bottom" />
          </span>
          <Tooltip id={HELP_ANCHORS.TOOLBAR_SYNC_CRM}>
            <button
              type="button"
              className="adminCot__btn"
              onClick={onRunSync}
              disabled={busyOp === "sync"}
            >
              ↕ Sync CRM
            </button>
          </Tooltip>
          <a
            href={exportCsvHref}
            target="_blank"
            rel="noopener noreferrer"
            className="adminCot__btn adminCot__btn--ghost"
          >
            ↓ Export CSV
          </a>
          <button
            type="button"
            className="adminCot__btn adminCot__btn--ghost"
            onClick={onRefresh}
            disabled={loading}
            title="Recargar (R)"
          >
            ↺ {loading ? "…" : "Refresh"}
          </button>
        </div>

        <div style={{ width: "100%", fontSize: 11, color: "var(--ac-text-2)" }}>
          {rowCount} fila{rowCount === 1 ? "" : "s"} mostradas
          {sheetRowCount != null && sheetRowCount !== rowCount ? ` · ${sheetRowCount} en planilla` : ""}
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="adminCot__bulkbar" role="region" aria-label="Acciones de selección">
          <span>{selectedCount} seleccionada{selectedCount === 1 ? "" : "s"}</span>
          <Tooltip id={HELP_ANCHORS.TOOLBAR_BULK_MARK_ENVIADAS}>
            <button
              type="button"
              className="adminCot__btn"
              onClick={onMarkSelectedEnviados}
              disabled={busyOp === "enviado-series"}
            >
              Marcar enviadas en serie
            </button>
          </Tooltip>
        </div>
      )}

      {batchOpen && (
        <BatchModal
          opts={batchOpts}
          onChange={updateBatchOpts}
          onClose={() => setBatchOpen(false)}
          onConfirm={(opts) => onRunBatch(opts)}
          onResetDefaults={onResetBatchOpts}
        />
      )}

      {nuevaOpen && onCreateRow && (
        <NuevaConsultaModal
          onClose={() => setNuevaOpen(false)}
          onConfirm={(form) => onCreateRow(form)}
          busy={busyOp === "create"}
        />
      )}
    </>
  );
}
