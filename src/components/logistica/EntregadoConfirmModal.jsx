/**
 * Confirm Entregado / Enviado: comments + optional signed remito upload.
 */
import React, { useEffect, useState } from "react";

export default function EntregadoConfirmModal({
  open,
  clientLabel = "",
  mode = "entregado",
  busy = false,
  onCancel,
  onConfirm,
  theme,
}) {
  const [comment, setComment] = useState("");
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");

  // Reset form when opening for a new sale — avoid carrying remito/comment across clients.
  useEffect(() => {
    if (open) {
      setComment("");
      setFile(null);
      setErr("");
    }
  }, [open, clientLabel, mode]);

  if (!open) return null;

  const T = theme || {
    brand: "#0071e3",
    danger: "#b42318",
    muted: "#64748b",
    surface: "#fff",
  };
  const title = mode === "enviado" ? "Confirmar Enviado" : "Confirmar Entregado";
  const blurb =
    mode === "enviado"
      ? "Se marcará como enviado y se moverá a la pestaña de archivo (Enviados / Ventas realizadas)."
      : "Se marcará como entregado, se pedirá confirmación y se archivará la fila en la planilla. Podés adjuntar el remito firmado.";

  async function handleConfirm() {
    setErr("");
    let remitoBase64 = null;
    let remitoFileName = null;
    if (file) {
      if (file.size > 12 * 1024 * 1024) {
        setErr("El remito supera 12 MB.");
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
        remitoBase64 = btoa(binary);
        remitoFileName = file.name || "remito-firmado.pdf";
      } catch {
        setErr("No se pudo leer el archivo del remito.");
        return;
      }
    }
    onConfirm?.({
      comment: comment.trim(),
      remitoBase64,
      remitoFileName,
      mode,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="entregado-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.();
      }}
    >
      <div
        style={{
          width: "min(480px, 100%)",
          background: T.surface,
          borderRadius: 14,
          padding: 20,
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
          border: "1px solid #e2e8f0",
        }}
      >
        <h3 id="entregado-modal-title" style={{ margin: "0 0 6px", fontSize: 17, color: T.brand }}>
          {title}
        </h3>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: T.muted, lineHeight: 1.4 }}>
          <strong>{clientLabel || "Cliente"}</strong>
          <br />
          {blurb}
        </p>
        <label htmlFor="entregado-comment" style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
          Comentarios (opcional)
        </label>
        <textarea
          id="entregado-comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={busy}
          placeholder="Ej. entregado en obra, firmó Juan…"
          style={{
            width: "100%",
            boxSizing: "border-box",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            padding: 8,
            fontSize: 13,
            marginBottom: 12,
            resize: "vertical",
          }}
        />
        <label htmlFor="entregado-remito" style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
          Remito firmado (PDF/JPG, opcional → Drive carpeta cliente)
        </label>
        <input
          id="entregado-remito"
          type="file"
          accept=".pdf,image/*,application/pdf"
          disabled={busy}
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={{ fontSize: 12, marginBottom: 10, width: "100%" }}
        />
        {file ? (
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
            Archivo: {file.name} ({Math.round(file.size / 1024)} KB)
          </div>
        ) : null}
        {err ? (
          <div style={{ color: T.danger, fontSize: 12, marginBottom: 8, background: "#ffeceb", padding: 8, borderRadius: 8 }}>
            {err}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => onCancel?.()}
            style={{
              border: "1px solid #cbd5e1",
              background: "#fff",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: busy ? "wait" : "pointer",
              fontWeight: 600,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleConfirm}
            style={{
              border: "none",
              background: T.brand,
              color: "#fff",
              borderRadius: 8,
              padding: "8px 14px",
              cursor: busy ? "wait" : "pointer",
              fontWeight: 700,
            }}
          >
            {busy ? "Guardando…" : "Confirmar y archivar"}
          </button>
        </div>
      </div>
    </div>
  );
}
