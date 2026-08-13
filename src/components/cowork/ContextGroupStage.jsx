/**
 * Focused workspace tab body: snapshot / note / share / soft terminal.
 */
import React, { useState } from "react";

const wrap = {
  flexShrink: 0,
  padding: "8px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(0,0,0,0.12)",
  color: "rgba(255,255,255,0.9)",
  fontSize: 12,
  minWidth: 0,
};

const btn = {
  border: "1px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

export default function ContextGroupStage({
  tab,
  shareMeta = {},
  onCapture,
  onLive,
  onStopShare,
  onPatchTab,
  calcState,
  setAiPick,
  disabled = false,
}) {
  const [cmd, setCmd] = useState("");
  const [log, setLog] = useState(["panelin> help"]);
  if (!tab) return null;

  const live = !!shareMeta.live;
  const thumb = shareMeta.thumbUrl;
  const err = shareMeta.error;

  const runTerm = (raw) => {
    const line = String(raw || "").trim();
    if (!line) return;
    const [head, ...rest] = line.toLowerCase().split(/\s+/);
    let out = "";
    if (head === "help") {
      out = "comandos: grok | claude | gemini | auto | share | help  (no es un shell del Mac)";
    } else if (["grok", "claude", "gemini", "auto"].includes(head)) {
      setAiPick?.(head === "auto" ? "auto" : `${head}|`);
      out = `IA → ${head}`;
    } else if (head === "share") {
      onCapture?.();
      out = "abriendo captura de esta pestaña…";
    } else if (head === "quote" || head === "calc") {
      out = rest.join(" ") || "escribí el pedido en el chat de abajo";
    } else {
      out = `desconocido: ${head}. help`;
    }
    setLog((prev) => [...prev.slice(-20), `> ${line}`, out]);
    setCmd("");
  };

  return (
    <div style={wrap} data-testid="pmca-context-stage">
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {tab.label}{" "}
        <span style={{ opacity: 0.55, fontWeight: 500 }}>{tab.kind}</span>
        {live ? <span style={{ color: "#f87171", marginLeft: 8 }}>● live</span> : null}
      </div>

      {tab.kind === "calc" && (
        <div style={{ opacity: 0.85, lineHeight: 1.4 }}>
          Escenario {calcState?.scenario || "—"} · lista {calcState?.listaPrecios || "—"}
          {calcState?.proyecto?.nombre ? ` · ${calcState.proyecto.nombre}` : ""}
          <div style={{ opacity: 0.6, marginTop: 4 }}>El chat ya ve esta cotización. Compartí pantalla si hay otra vista.</div>
        </div>
      )}
      {tab.kind === "email" && (
        <div style={{ opacity: 0.85 }}>Correos BMC — un clic comparte esa vista.</div>
      )}
      {tab.kind === "admin" && (
        <div style={{ opacity: 0.85 }}>Admin / Hub — un clic comparte la planilla.</div>
      )}
      {tab.kind === "note" && (
        <textarea
          data-no-drag
          value={tab.summary || ""}
          disabled={disabled}
          onChange={(e) => onPatchTab?.({ summary: e.target.value })}
          placeholder="Nota compartida con el agente…"
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(0,0,0,0.25)",
            color: "#fff",
            fontSize: 12,
            padding: 8,
            resize: "vertical",
          }}
        />
      )}
      {tab.kind === "term" && (
        <div>
          <div
            style={{
              fontFamily: "ui-monospace, Menlo, monospace",
              fontSize: 11,
              background: "#0b0b0d",
              borderRadius: 8,
              padding: 8,
              maxHeight: 96,
              overflowY: "auto",
              marginBottom: 6,
              whiteSpace: "pre-wrap",
            }}
          >
            {log.join("\n")}
          </div>
          <input
            data-no-drag
            value={cmd}
            disabled={disabled}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runTerm(cmd);
            }}
            placeholder="panelin> grok | claude | gemini | share"
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontFamily: "ui-monospace, Menlo, monospace",
              fontSize: 11,
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "#111",
              color: "#9fef9f",
            }}
          />
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}>
        <button type="button" data-no-drag style={btn} disabled={disabled} onClick={() => onCapture?.()}>
          Capturar
        </button>
        <button
          type="button"
          data-no-drag
          style={{ ...btn, ...(live ? { background: "#d93025", borderColor: "#d93025" } : {}) }}
          disabled={disabled}
          onClick={() => onLive?.(!live)}
        >
          {live ? "Live ON" : "Live"}
        </button>
        {(live || shareMeta.sharing) && (
          <button type="button" data-no-drag style={btn} disabled={disabled} onClick={() => onStopShare?.()}>
            Detener
          </button>
        )}
        {thumb && (
          <img src={thumb} alt="" width={48} height={32} style={{ borderRadius: 4, objectFit: "cover" }} />
        )}
      </div>
      {err ? <div style={{ color: "#fca5a5", marginTop: 4, fontSize: 11 }}>{err}</div> : null}
    </div>
  );
}
