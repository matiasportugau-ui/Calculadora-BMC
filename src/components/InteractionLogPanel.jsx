// ═══════════════════════════════════════════════════════════════════════════
// InteractionLogPanel.jsx — Panel para exportar log de interacción
// Solo visible en desarrollo (import.meta.env.DEV)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { ClipboardList, Copy, ChevronUp, ChevronDown, MessageSquare, Save } from "lucide-react";
import { getLog, copyToClipboard, copyForCursor, saveToFile, clear, setStateSnapshotGetter } from "../utils/interactionLogger.js";

const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV === true;

export default function InteractionLogPanel({ getSnapshot }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedFormat, setCopiedFormat] = useState(null); // "json" | "cursor"
  const [savedPath, setSavedPath] = useState(null);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (isDev && getSnapshot) setStateSnapshotGetter(getSnapshot);
    return () => setStateSnapshotGetter(null);
  }, [getSnapshot]);

  if (!isDev) return null;

  const entries = getLog();
  const handleCopyJson = async () => {
    const ok = await copyToClipboard();
    if (ok) {
      setCopied(true);
      setCopiedFormat("json");
      setTimeout(() => { setCopied(false); setCopiedFormat(null); }, 2000);
    }
  };
  const handleCopyForCursor = async () => {
    const ok = await copyForCursor();
    if (ok) {
      setCopied(true);
      setCopiedFormat("cursor");
      setTimeout(() => { setCopied(false); setCopiedFormat(null); }, 2000);
    }
  };
  const handleSaveToFile = async () => {
    setSaveError(null);
    setSavedPath(null);
    const result = await saveToFile();
    if (result.ok) {
      setSavedPath(result.path);
      setTimeout(() => setSavedPath(null), 4000);
    } else {
      setSaveError(result.error || "API no disponible (¿npm run dev:full?)");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 9998,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#1a1a2e",
        color: "#eaeaea",
        borderRadius: 12,
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        overflow: "hidden",
        minWidth: expanded ? 320 : 52,
        fontSize: 13,
      }}
    >
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          cursor: "pointer",
          borderBottom: expanded ? "1px solid rgba(255,255,255,0.1)" : "none",
        }}
      >
        <ClipboardList size={18} color="#6ee7b7" />
        <span style={{ fontWeight: 600, flex: 1 }}>Log interacción</span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{entries.length}</span>
        {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </div>

      {expanded && (
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
            1. Interactuá con la calculadora<br />
            2. Copiá el log (formato Cursor recomendado)<br />
            3. Pegá en el chat + escribí tu modificación
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              onClick={handleCopyForCursor}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "10px 12px",
                borderRadius: 8,
                border: "none",
                background: copied && copiedFormat === "cursor" ? "#10b981" : "#6366f1",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <MessageSquare size={14} />
              {copied && copiedFormat === "cursor" ? "Copiado" : "Copiar para Cursor"}
            </button>
            <button
              onClick={handleCopyJson}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.2)",
                background: copied && copiedFormat === "json" ? "#10b981" : "transparent",
                color: copied && copiedFormat === "json" ? "#fff" : "#94a3b8",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              <Copy size={12} />
              {copied && copiedFormat === "json" ? "Copiado" : "Solo JSON"}
            </button>
            <button
              onClick={handleSaveToFile}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                color: "#94a3b8",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              <Save size={12} />
              {savedPath ? "Guardado" : "Guardar en archivo"}
            </button>
            {saveError && <span style={{ fontSize: 10, color: "#f87171" }}>{saveError}</span>}
            <button
              onClick={() => { clear(); setExpanded(false); setSaveError(null); setSavedPath(null); }}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                color: "#94a3b8",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Limpiar log
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
