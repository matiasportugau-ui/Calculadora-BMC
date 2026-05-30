import { useEffect, useState } from "react";
// F1 features (PRs #224, #225, #226, #229 — OPERATOR_CODES feeds the Responsable select)
import { OPERATOR_CODES, operatorLabel, suggestOwner } from "../../utils/cotizacionAssignment.js";
import WaTimelineInline from "./WaTimelineInline.jsx";
// Phase 3 tutorial UI (PR #223 — Hybrid RBAC + Phase 3 wiring)
import Tooltip from "../help/Tooltip.jsx";
import HelpButton from "../help/HelpButton.jsx";
import { HELP_ANCHORS } from "../help/anchors.js";

export default function DetailDrawer({ row, onClose, onSave, onApprove, onMarkEnviado, onRequestSuggestion, onOpenBorrador, busyOp, waToken, waApiBase }) {
  const [respuesta, setRespuesta] = useState(row?.respuesta || "");
  const [link, setLink] = useState(row?.link || "");
  const [replay, setReplay] = useState(row?.replaySnapshotUrl || "");
  const [lastProvider, setLastProvider] = useState("");
  const [responsable, setResponsable] = useState(() => {
    if (row?.responsable) return row.responsable;
    return suggestOwner({ origen: row?.origen, consulta: row?.consulta });
  });

  useEffect(() => {
    setRespuesta(row?.respuesta || "");
    setLink(row?.link || "");
    setReplay(row?.replaySnapshotUrl || "");
    setLastProvider("");
    setResponsable(
      row?.responsable || suggestOwner({ origen: row?.origen, consulta: row?.consulta })
    );
  }, [row]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!row) return null;

  const saving = busyOp === "save";
  const approving = busyOp === "approve";
  const moving = busyOp === "enviado";
  const suggesting = busyOp === "suggest";
  const busy = Boolean(busyOp);

  const suggestedCode = suggestOwner({ origen: row.origen, consulta: row.consulta });

  const handleSuggest = async () => {
    if (!onRequestSuggestion) return;
    const { ok, data } = await onRequestSuggestion(row);
    if (ok && data?.respuesta) {
      setRespuesta(data.respuesta);
      setLastProvider(data.provider || "");
    }
  };

  return (
    <div
      className="adminCot__drawer-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <aside className="adminCot__drawer" role="dialog" aria-modal="true" aria-label={`Fila ${row.rowNum}`}>
        <header className="adminCot__drawer-header">
          <div>
            <div style={{ fontSize: 13, color: "var(--ac-text-2)" }}>Fila {row.rowNum} · {row.id || "sin ID"}</div>
            <strong style={{ fontSize: 16 }}>{row.cliente || "(sin nombre)"}</strong>
            <div style={{ fontSize: 12, color: "var(--ac-text-2)", marginTop: 4 }}>
              💡 Sugerido: <strong>{operatorLabel(suggestedCode)}</strong>{" "}
              <span style={{ opacity: 0.6 }}>({suggestedCode})</span>{" "}
              <span style={{ opacity: 0.6 }}>· podés sobrescribir al asignar</span>
            </div>
          </div>
          <button
            type="button"
            className="adminCot__btn adminCot__btn--ghost adminCot__btn--sm"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className="adminCot__drawer-body">
          <div className="adminCot__drawer-section">
            <span className="adminCot__drawer-label">Consulta del cliente (I)</span>
            <p className="adminCot__drawer-readonly">{row.consulta || "(sin texto)"}</p>
          </div>

          {String(row.origen || "").trim().toUpperCase() === "WA" && row.telefono && waToken && (
            <div className="adminCot__drawer-section">
              <details>
                <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--ac-text)" }}>
                  📱 Historial WhatsApp
                </summary>
                <WaTimelineInline phone={row.telefono} token={waToken} apiBase={waApiBase} />
              </details>
            </div>
          )}

          <div className="adminCot__drawer-section">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span className="adminCot__drawer-label">Respuesta IA (J) — editable</span>
              {onRequestSuggestion && (
                <button
                  type="button"
                  className="adminCot__btn adminCot__btn--ghost adminCot__btn--sm"
                  onClick={handleSuggest}
                  disabled={busy || !row.consulta}
                  title="Genera una respuesta IA solo para esta fila (4-LLM fallback con KB + historial)"
                >
                  {suggesting ? "Sugiriendo…" : "✦ Sugerir IA"}
                </button>
              )}
            </div>
            <textarea
              className="adminCot__textarea"
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              rows={6}
              placeholder="Respuesta al cliente…"
            />
            <p className="adminCot__hint">
              {lastProvider ? <>Generada por <strong>{lastProvider}</strong>. </> : null}
              Click <strong>&ldquo;✦ Sugerir IA&rdquo;</strong> para regenerar solo esta fila (no toca las otras).
              El batch IA de la barra superior sigue disponible para reprocesar todas las pendientes a la vez.
              <HelpButton id={HELP_ANCHORS.DRAWER_REGENERATE_HINT} label="Más sobre regenerar" />
            </p>
          </div>

          <div className="adminCot__drawer-section">
            <span className="adminCot__drawer-label">Link presupuesto (K)</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url"
                className="adminCot__input"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://storage.googleapis.com/…"
              />
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="adminCot__btn adminCot__btn--ghost"
                >
                  Abrir ↗
                </a>
              )}
            </div>
          </div>

          <div className="adminCot__drawer-section">
            <span className="adminCot__drawer-label">Responsable — CRM_Operativo col 11</span>
            <select
              className="adminCot__input"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              disabled={busy}
              style={{ width: "100%", maxWidth: 280 }}
              aria-label="Asignar responsable"
            >
              {OPERATOR_CODES.map((code) => (
                <option key={code} value={code}>
                  {operatorLabel(code)} ({code})
                </option>
              ))}
            </select>
            <p className="adminCot__hint">
              Default = sugerencia automática. Se persiste en{" "}
              <code>CRM_Operativo.Responsable</code> al hacer Guardar
              (PATCH <code>/api/cotizaciones/&lt;id&gt;</code>). Si la fila
              no existe aún en CRM, el server devuelve 4xx y la respuesta
              en Admin se guarda igual.
            </p>
          </div>

          {/* Tanda 1 - Rich Borrador Integration (from Cotizar button hybrid model) */}
          <div className="adminCot__drawer-section" style={{ background: "#fefce8", padding: 12, borderRadius: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="adminCot__drawer-label" style={{ color: "#854d0e" }}>Borrador (flujo híbrido)</span>
              {onOpenBorrador && (
                <button 
                  type="button" 
                  className="adminCot__btn adminCot__btn--sm" 
                  style={{ background: "#fef3c7", color: "#92400e" }}
                  onClick={() => onOpenBorrador(row)}
                >
                  Ver Borrador
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#713f12" }}>
              {row.borradorPdf ? (
                <a href={row.borradorPdf} target="_blank" rel="noopener noreferrer" style={{ color: "#854d0e", textDecoration: "underline" }}>
                  PDF del Borrador ↗
                </a>
              ) : "Sin PDF de borrador aún"}
              <br />
              {row.borradorExplicacion ? "Explicación generada ✓" : "Sin explicación de borrador"}
            </div>
            <p className="adminCot__hint" style={{ marginTop: 6, color: "#854d0e" }}>
              Generado vía el botón &quot;Cotizar&quot; de la planilla (modelo híbrido). 
              Si no existe, puedes usar el batch IA superior o el botón &quot;Sugerir IA&quot;.
            </p>
          </div>

          <div className="adminCot__drawer-section">
            <span className="adminCot__drawer-label">Replay JSON (M)</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url"
                className="adminCot__input"
                value={replay}
                onChange={(e) => setReplay(e.target.value)}
                placeholder="https://storage.googleapis.com/…/quotes/…json"
              />
              {replay && (
                <a
                  href={replay}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="adminCot__btn adminCot__btn--ghost"
                >
                  Abrir ↗
                </a>
              )}
            </div>
            <p className="adminCot__hint">
              Snapshot completo del cálculo IA (lo escribe el batch cuando hay bucket GCS). Pegá un export
              de la calculadora para comparar manual vs IA.
            </p>
          </div>
        </div>

        <footer className="adminCot__drawer-footer">
          <Tooltip id={HELP_ANCHORS.DRAWER_SAVE_RESPONSE}>
            <button
              type="button"
              className="adminCot__btn adminCot__btn--primary"
              onClick={() => onSave(row.rowNum, {
                respuesta,
                link,
                replaySnapshotUrl: replay,
                responsable,
                cotizacionId: row.id,
              })}
              disabled={busy}
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </Tooltip>
          <Tooltip id={HELP_ANCHORS.DRAWER_APROBAR}>
            <button
              type="button"
              className="adminCot__btn adminCot__btn--success"
              onClick={() => onApprove(row.rowNum)}
              disabled={busy || row.estado === "Aprobado"}
            >
              {approving ? "Aprobando…" : row.estado === "Aprobado" ? "Aprobada ✓" : "Aprobar"}
            </button>
          </Tooltip>
          <Tooltip id={HELP_ANCHORS.DRAWER_MARCAR_ENVIADA}>
            <button
              type="button"
              className="adminCot__btn"
              onClick={() => onMarkEnviado(row.rowNum)}
              disabled={busy}
              title="Mueve la fila a la pestaña Enviados y la borra del Admin."
            >
              {moving ? "Moviendo…" : "Marcar enviada"}
            </button>
          </Tooltip>
          <button
            type="button"
            className="adminCot__btn adminCot__btn--ghost"
            onClick={onClose}
          >
            Cancelar
          </button>
        </footer>
      </aside>
    </div>
  );
}
