import { useEffect, useState } from "react";

export default function DetailDrawer({ row, onClose, onSave, onApprove, onMarkEnviado, busyOp }) {
  const [respuesta, setRespuesta] = useState(row?.respuesta || "");
  const [link, setLink] = useState(row?.link || "");
  const [replay, setReplay] = useState(row?.replaySnapshotUrl || "");

  useEffect(() => {
    setRespuesta(row?.respuesta || "");
    setLink(row?.link || "");
    setReplay(row?.replaySnapshotUrl || "");
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
  const busy = Boolean(busyOp);

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

          <div className="adminCot__drawer-section">
            <span className="adminCot__drawer-label">Respuesta IA (J) — editable</span>
            <textarea
              className="adminCot__textarea"
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              rows={6}
              placeholder="Respuesta al cliente…"
            />
            <p className="adminCot__hint">
              Para regenerar la respuesta con IA, vaciá este campo (o dejá el ⚠) y corré &ldquo;Generar IA&rdquo; desde
              la barra superior — el batch reprocesa todas las filas pendientes (limitación actual del backend).
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
          <button
            type="button"
            className="adminCot__btn adminCot__btn--primary"
            onClick={() => onSave(row.rowNum, { respuesta, link, replaySnapshotUrl: replay })}
            disabled={busy}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button
            type="button"
            className="adminCot__btn adminCot__btn--success"
            onClick={() => onApprove(row.rowNum)}
            disabled={busy || row.estado === "Aprobado"}
          >
            {approving ? "Aprobando…" : row.estado === "Aprobado" ? "Aprobada ✓" : "Aprobar"}
          </button>
          <button
            type="button"
            className="adminCot__btn"
            onClick={() => onMarkEnviado(row.rowNum)}
            disabled={busy}
            title="Mueve la fila a la pestaña Enviados y la borra del Admin."
          >
            {moving ? "Moviendo…" : "Marcar enviada"}
          </button>
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
