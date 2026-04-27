import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader, Check, AlertTriangle } from "lucide-react";
import { C, FONT, TR } from "../data/constants.js";

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf", ".dxf"]);

function getExt(name) {
  return (name || "").toLowerCase().match(/\.[^.]+$/)?.[0] || "";
}

export default function PlanInlineDropZone({ onZonasLoaded, disabled }) {
  const [phase, setPhase] = useState("idle"); // idle | loading | success | error
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file || disabled) return;
    const ext = getExt(file.name);

    if (ext === ".dwg") {
      setMessage("DWG no soportado — exportá a DXF desde AutoCAD.");
      setPhase("error");
      return;
    }
    if (!ALLOWED_EXTS.has(ext) && !file.type.startsWith("image/") && file.type !== "application/pdf") {
      setMessage("Formato no soportado. Usá JPG, PNG, PDF o DXF.");
      setPhase("error");
      return;
    }

    setPhase("loading");
    const form = new FormData();
    form.append("file", file);

    try {
      const resp = await fetch("/api/plan/interpret", { method: "POST", body: form });
      const data = await resp.json();

      if (!resp.ok || !data.bmcPayload?.techo?.zonas?.length) {
        setMessage(data.error || "No se pudieron extraer dimensiones del plano.");
        setPhase("error");
        return;
      }

      const { zonas, tipoAguas, pendiente } = data.bmcPayload.techo;
      const validZonas = zonas.filter(z => z.largo > 0 && z.ancho > 0);

      if (!validZonas.length) {
        setMessage("No se detectaron zonas con dimensiones válidas.");
        setPhase("error");
        return;
      }

      onZonasLoaded(validZonas, tipoAguas || "una_agua", pendiente || 0);
      setMessage(`${validZonas.length} zona${validZonas.length > 1 ? "s" : ""} importada${validZonas.length > 1 ? "s" : ""} desde plano`);
      setPhase("success");
    } catch {
      setMessage("Error de red al interpretar el plano.");
      setPhase("error");
    }
  }, [disabled, onZonasLoaded]);

  const reset = useCallback(() => {
    setPhase("idle");
    setMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  if (phase === "success") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "#F0FDF4", border: "1.5px solid #86EFAC", fontFamily: FONT }}>
        <Check size={14} color="#16A34A" />
        <span style={{ fontSize: 12, color: "#15803D", flex: 1 }}>✓ {message}</span>
        <button
          type="button"
          onClick={reset}
          title="Importar otro plano"
          style={{ border: "none", background: "transparent", cursor: "pointer", color: "#6B7280", padding: 2, display: "flex", borderRadius: 4 }}
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "#FEF2F2", border: "1.5px solid #FCA5A5", fontFamily: FONT }}>
        <AlertTriangle size={14} color="#DC2626" />
        <span style={{ fontSize: 12, color: "#DC2626", flex: 1 }}>{message}</span>
        <button
          type="button"
          onClick={reset}
          style={{ border: "none", background: "transparent", cursor: "pointer", color: "#6B7280", padding: 2, display: "flex", borderRadius: 4 }}
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: C.primarySoft, border: `1.5px solid ${C.primary}`, fontFamily: FONT }}>
        <Loader size={14} color={C.primary} style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 12, color: C.primary }}>Interpretando plano con IA…</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); if (!disabled) handleFile(e.dataTransfer.files[0]); }}
      onClick={() => !disabled && fileInputRef.current?.click()}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 10,
        border: `1.5px dashed ${dragOver ? C.primary : C.border}`,
        background: dragOver ? C.primarySoft : "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: TR,
        fontFamily: FONT,
      }}
    >
      <Upload size={14} color={dragOver ? C.primary : C.ts} />
      <span style={{ fontSize: 12, color: dragOver ? C.primary : C.ts }}>
        Importar desde plano
        <span style={{ color: C.tt, marginLeft: 4 }}>JPG · PNG · PDF · DXF</span>
      </span>
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,.dxf"
        style={{ display: "none" }}
        onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
      />
    </div>
  );
}
