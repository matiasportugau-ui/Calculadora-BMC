// ═══════════════════════════════════════════════════════════════════════════
// Simulacro local: gestión de especificaciones → mismo pipeline PDF que cotización
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  ArrowLeft, FileDown, ClipboardList, Printer, Sparkles, Send, Loader2, AlertCircle,
} from "lucide-react";
import { C, FONT, SHC, TR, TN } from "../data/constants.js";
import {
  SPEC_SANDBOX_INITIAL,
  generateSpecManagementSandboxHTML,
  createPreviewUrl,
  revokePreviewUrl,
} from "../utils/helpers.js";
import { downloadPdf } from "../utils/pdfGenerator.js";
import { fetchTeamAssistChat, fetchTeamAssistHealth } from "../utils/teamAssistApi.js";

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

const sectionBlockS = {
  borderRadius: 16,
  border: `1.5px solid ${C.border}`,
  padding: 20,
  background: C.surface,
  boxShadow: SHC,
  marginBottom: 16,
  fontFamily: FONT,
};

export default function SpecManagementSandbox({ onBack }) {
  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById("bmc-spec-spin")) return;
    const s = document.createElement("style");
    s.id = "bmc-spec-spin";
    s.textContent = "@keyframes bmc-spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(s);
  }, []);

  const [data, setData] = useState(() => {
    const d = deepClone(SPEC_SANDBOX_INITIAL);
    d.project.fecha = new Date().toLocaleDateString("es-UY");
    return d;
  });
  const [previewHtml, setPreviewHtml] = useState(null);
  const [busy, setBusy] = useState(false);
  const [assistHealth, setAssistHealth] = useState(null);

  const html = useMemo(() => generateSpecManagementSandboxHTML(data), [data]);

  useEffect(() => {
    let cancelled = false;
    fetchTeamAssistHealth()
      .then((h) => { if (!cancelled) setAssistHealth(h); })
      .catch(() => { if (!cancelled) setAssistHealth({ ok: false, error: "No se pudo contactar al servidor" }); });
    return () => { cancelled = true; };
  }, []);

  const updateCheck = useCallback((id, status) => {
    setData(prev => ({
      ...prev,
      checklist: prev.checklist.map(c => (c.id === id ? { ...c, status } : c)),
    }));
  }, []);

  const setNotes = useCallback((text) => {
    setData(prev => ({
      ...prev,
      notes: text.split("\n").map(s => s.trim()).filter(Boolean),
    }));
  }, []);

  const openPreview = useCallback(() => {
    setPreviewHtml(html);
  }, [html]);

  const closePreview = useCallback(() => setPreviewHtml(null), []);

  const handlePdf = useCallback(async () => {
    setBusy(true);
    try {
      const name = `Simulacro especificaciones — ${data.quotationId || "BMC"}.pdf`;
      await downloadPdf(html, name);
    } finally {
      setBusy(false);
    }
  }, [html, data.quotationId]);

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: "100vh" }}>
      <div
        style={{
          background: C.brand,
          color: "#fff",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.35)",
              background: "transparent",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
            }}
          >
            <ArrowLeft size={16} />
            Calculadora
          </button>
          <ClipboardList size={20} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.5px" }}>
              Simulacro — Especificaciones
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>Práctica local · PDF alineado a cotización BMC</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={openPreview}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.35)",
              background: "transparent",
              color: "#fff",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Printer size={14} />
            Vista previa
          </button>
          <button
            type="button"
            onClick={handlePdf}
            disabled={busy}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: C.primary,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: busy ? 0.85 : 1,
            }}
          >
            <FileDown size={14} />
            {busy ? "Generando…" : "Descargar PDF"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
        <p style={{ fontSize: 14, color: C.ts, lineHeight: 1.5, marginBottom: 20 }}>
          Usá este simulacro para ensayar el flujo de revisión de especificaciones y exportar un PDF con el mismo aspecto
          que la cotización de la calculadora. Los valores demo son editables; el PDF refleja lo que cargues acá.
        </p>

        <TeamAssistPanel data={data} assistHealth={assistHealth} />

        <div style={sectionBlockS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Identificación
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, color: C.ts }}>Código cotización</span>
              <input
                value={data.quotationId}
                onChange={e => setData(d => ({ ...d, quotationId: e.target.value }))}
                style={inputS}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, color: C.ts }}>Cliente</span>
              <input
                value={data.client.nombre}
                onChange={e => setData(d => ({ ...d, client: { ...d.client, nombre: e.target.value } }))}
                style={inputS}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, color: C.ts }}>Obra / descripción</span>
              <input
                value={data.project.descripcion}
                onChange={e => setData(d => ({ ...d, project: { ...d.project, descripcion: e.target.value } }))}
                style={inputS}
              />
            </label>
          </div>
        </div>

        <div style={sectionBlockS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Checklist de especificación
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.checklist.map(row => (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  background: C.surfaceAlt,
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                }}
              >
                <span style={{ fontSize: 13, color: C.tp, flex: 1 }}>{row.label}</span>
                <select
                  value={row.status}
                  onChange={e => updateCheck(row.id, e.target.value)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1.5px solid ${C.border}`,
                    fontSize: 13,
                    fontFamily: FONT,
                    background: C.surface,
                    color: C.tp,
                    ...TN,
                  }}
                >
                  <option value="ok">OK</option>
                  <option value="pending">Pendiente</option>
                  <option value="na">N/A</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        <div style={sectionBlockS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Notas internas (PDF)
          </div>
          <textarea
            value={data.notes.join("\n")}
            onChange={e => setNotes(e.target.value)}
            rows={5}
            style={{
              ...inputS,
              width: "100%",
              resize: "vertical",
              lineHeight: 1.45,
            }}
          />
        </div>

        <div style={sectionBlockS}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Totales USD (manual)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { key: "subtotalSinIVA", label: "Subtotal s/IVA" },
              { key: "iva", label: "IVA 22%" },
              { key: "totalFinal", label: "Total" },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: C.ts }}>{label}</span>
                <input
                  type="number"
                  step="0.01"
                  value={data.totals[key]}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    if (Number.isNaN(v)) return;
                    setData(d => ({ ...d, totals: { ...d.totals, [key]: v } }));
                  }}
                  style={inputS}
                />
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const d = deepClone(SPEC_SANDBOX_INITIAL);
            d.project.fecha = new Date().toLocaleDateString("es-UY");
            setData(d);
          }}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: `1.5px solid ${C.border}`,
            background: C.surface,
            color: C.tp,
            fontSize: 13,
            cursor: "pointer",
            transition: TR,
            fontFamily: FONT,
          }}
        >
          Restaurar datos demo
        </button>
      </div>

      {previewHtml && (
        <SandboxPreviewModal html={previewHtml} onClose={closePreview} />
      )}
    </div>
  );
}

const inputS = {
  padding: "10px 12px",
  borderRadius: 10,
  border: `1.5px solid ${C.border}`,
  fontSize: 14,
  fontFamily: FONT,
  outline: "none",
  boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
};

const AGENTS_UI = [
  { id: "orchestrator", label: "Orquestador", hint: "Coordina y pregunta lo mínimo" },
  { id: "analyst", label: "Análisis", hint: "Ordena la información que tirás" },
  { id: "calc", label: "Presupuestación", hint: "Técnico calc / BOM" },
  { id: "sheets", label: "Planillas", hint: "Sheets y carga de datos" },
];

function TeamAssistPanel({ data, assistHealth }) {
  const [agentId, setAgentId] = useState("orchestrator");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setErr(null);
    const userMsg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setDraft("");
    setSending(true);
    try {
      const res = await fetchTeamAssistChat({
        agentId,
        messages: next,
        context: { specSandbox: data },
      });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setErr(e.message || String(e));
      setMessages((m) => m.slice(0, -1));
      setDraft(text);
    } finally {
      setSending(false);
    }
  }, [agentId, messages, data, sending]);

  const ready = assistHealth?.openai_configured === true;
  const needServer = assistHealth && assistHealth.ok === false && !assistHealth.openai_configured;

  return (
    <div style={{ ...sectionBlockS, marginBottom: 20, border: `1.5px solid ${C.primarySoft}`, background: "#FAFBFF" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Sparkles size={20} color={C.primary} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.tp }}>Asistente equipo (IA)</div>
          <div style={{ fontSize: 12, color: C.ts }}>
            Elegí un rol y escribí: el modelo responde como ese integrante del equipo BMC (servidor + OpenAI).
          </div>
        </div>
      </div>

      {assistHealth && (
        <div
          style={{
            fontSize: 12,
            padding: "8px 12px",
            borderRadius: 8,
            marginBottom: 12,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            background: ready ? C.successSoft : C.warningSoft,
            color: C.tp,
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            {ready
              ? `Servidor listo · modelo ${assistHealth.model || "—"}`
              : "Configurá OPENAI_API_KEY en el servidor (npm run start:api) y recargá. Opcional: API_AUTH_TOKEN + VITE_API_AUTH_TOKEN."}
          </span>
        </div>
      )}
      {needServer && (
        <div style={{ fontSize: 11, color: C.ts, marginBottom: 10, lineHeight: 1.45 }}>
          Sin clave, el chat no puede llamar a OpenAI; el resto del simulacro sigue funcionando.
        </div>
      )}

      <label style={{ display: "block", marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: C.ts, display: "block", marginBottom: 6 }}>Rol del equipo</span>
        <select
          value={agentId}
          onChange={e => setAgentId(e.target.value)}
          disabled={!ready}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: `1.5px solid ${C.border}`,
            fontSize: 14,
            fontFamily: FONT,
            background: C.surface,
            color: C.tp,
          }}
        >
          {AGENTS_UI.map(a => (
            <option key={a.id} value={a.id}>{a.label} — {a.hint}</option>
          ))}
        </select>
      </label>

      <div
        style={{
          maxHeight: 260,
          overflowY: "auto",
          padding: 12,
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          background: C.surface,
          marginBottom: 10,
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: C.tt, fontSize: 12 }}>
            Ej.: «Tengo medidas 12×8, techo ISODEC 150 blanco, pendiente 15° — qué me falta para cerrar especificación?»
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: 10,
              padding: "8px 10px",
              borderRadius: 8,
              background: m.role === "user" ? C.primarySoft : C.surfaceAlt,
              borderLeft: m.role === "user" ? `3px solid ${C.primary}` : `3px solid ${C.border}`,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: C.ts, marginBottom: 4, textTransform: "uppercase" }}>
              {m.role === "user" ? "Vos" : "Equipo"}
            </div>
            <div style={{ whiteSpace: "pre-wrap", color: C.tp }}>{m.content}</div>
          </div>
        ))}
      </div>

      {err && (
        <div style={{ fontSize: 12, color: C.danger, marginBottom: 8 }}>{err}</div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={ready ? "Escribí tu consulta… (Enter envía, Shift+Enter salto)" : "Servidor sin OpenAI — no se puede enviar"}
          disabled={!ready || sending}
          rows={3}
          style={{
            ...inputS,
            flex: 1,
            resize: "vertical",
            minHeight: 72,
            opacity: ready ? 1 : 0.6,
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={!ready || sending || !draft.trim()}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            background: C.primary,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: !ready || sending || !draft.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            alignSelf: "stretch",
            opacity: !ready || sending || !draft.trim() ? 0.5 : 1,
          }}
        >
          {sending ? <Loader2 size={18} style={{ animation: "bmc-spin 0.9s linear infinite" }} /> : <Send size={18} />}
          Enviar
        </button>
      </div>
    </div>
  );
}

function SandboxPreviewModal({ html, onClose }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const u = createPreviewUrl(html);
    setUrl(u);
    return () => revokePreviewUrl(u);
  }, [html]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!url) return null;

  return (
    <div
      role="presentation"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        background: "rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: C.dark,
          color: "#fff",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700 }}>Vista previa — Simulacro especificaciones</div>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.3)",
            background: "transparent",
            color: "#fff",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Cerrar
        </button>
      </div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: 20, overflow: "auto" }}>
        <iframe
          title="Vista previa simulacro"
          src={url}
          style={{
            width: "210mm",
            maxWidth: "100%",
            height: "100%",
            border: "none",
            borderRadius: 8,
            boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
            background: "#fff",
          }}
        />
      </div>
    </div>
  );
}
