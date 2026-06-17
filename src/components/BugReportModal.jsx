import React, { useEffect, useState } from "react";
import { captureBugContext, addBugLog, addErrorToBugLog } from "../utils/bugCapture.js";
import { setBugReportOpener, openBugReport } from "../lib/bugReportBus.js";
import { captureElementToDataUrl } from "../utils/captureDomToPng.js";

const TOKEN_KEY = "bmc_cockpit_token";

function getCockpitToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function getCalcApiBase() {
  // Mirror logic from src/utils/calcApiBase.js without extra import surface
  try {
    const envBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) || "";
    if (envBase) return envBase;
  } catch { /* ignore env read */ }
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:3001";
    }
  }
  return ""; // relative (production usually served from same origin or via vercel rewrites)
}

async function submitBugReport(payload, token) {
  const base = getCalcApiBase().replace(/\/+$/, "");
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${base}/api/bugs/report`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    return { ok: true, data };
  } catch (e) {
    if (e.name === "AbortError") {
      return { ok: false, error: "Tiempo de espera agotado (30s)" };
    }
    return { ok: false, error: e.message || "Error de red" };
  } finally {
    clearTimeout(t);
  }
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  zIndex: 99999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const cardStyle = {
  background: "#fff",
  borderRadius: 12,
  width: "100%",
  maxWidth: 520,
  boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
  color: "#1d1d1f",
};

const headerStyle = {
  padding: "14px 18px",
  borderBottom: "1px solid #e5e5ea",
  fontWeight: 700,
  fontSize: 15,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const bodyStyle = { padding: 18, display: "flex", flexDirection: "column", gap: 12 };

const labelStyle = { fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 };

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #d1d1d6",
  borderRadius: 8,
  fontSize: 13,
  boxSizing: "border-box",
};

const textareaStyle = {
  ...inputStyle,
  minHeight: 72,
  resize: "vertical",
  fontFamily: "inherit",
};

const selectStyle = { ...inputStyle, width: "auto" };

const btnPrimary = {
  background: "#c0392b",
  color: "#fff",
  border: "none",
  padding: "10px 16px",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const btnGhost = {
  background: "transparent",
  color: "#333",
  border: "1px solid #d1d1d6",
  padding: "9px 14px",
  borderRadius: 8,
  fontSize: 13,
  cursor: "pointer",
};

const smallMuted = { fontSize: 11, color: "#666" };

export default function BugReportModal() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState(null); // { description?, error?, extra? }
  const [shortDesc, setShortDesc] = useState("");
  const [details, setDetails] = useState("");
  const [severity, setSeverity] = useState("media");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { ok, ref?, error? }
  const [showContext, setShowContext] = useState(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState(null);
  const [capturingShot, setCapturingShot] = useState(false);

  // Register the opener once when the component mounts
  useEffect(() => {
    setBugReportOpener((incomingOpts = {}) => {
      setOpts(incomingOpts);
      setShortDesc(incomingOpts.description || incomingOpts.error?.message || "");
      setDetails("");
      setSeverity("media");
      setResult(null);
      setShowContext(false);
      setOpen(true);
      // Log the report intent itself
      addBugLog("info", "bug report dialog opened", { via: incomingOpts.via || "ui" });
    });
    return () => setBugReportOpener(null);
  }, []);

  const close = () => {
    setOpen(false);
    // small delay to allow animation if we add one later
    setTimeout(() => {
      setOpts(null);
      setShortDesc("");
      setDetails("");
      setResult(null);
      setShowContext(false);
      setScreenshotDataUrl(null);
    }, 120);
  };

  const handleCaptureScreenshot = async () => {
    setCapturingShot(true);
    try {
      // Simple canvas capture of main content (reuses existing html2canvas helper)
      const target = document.querySelector("main") || document.body;
      const data = await captureElementToDataUrl(target, { scale: 1.2, quality: 0.75 });
      if (data) {
        setScreenshotDataUrl(data);
        addBugLog("info", "bug_screenshot_captured", { size: data.length });
      } else {
        alert("No se pudo capturar la pantalla (elemento muy pequeño o error de canvas).");
      }
    } catch (e) {
      addErrorToBugLog(e, { action: "capture_screenshot" });
      alert("Error capturando pantalla: " + (e?.message || e));
    } finally {
      setCapturingShot(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!shortDesc.trim()) {
      alert("Por favor escribí una descripción corta del problema.");
      return;
    }

    setSubmitting(true);
    setResult(null);

    const token = getCockpitToken();
    const context = captureBugContext({
      ...(opts?.extra || {}),
      via: opts?.via || "modal",
      severity,
    });

    if (screenshotDataUrl) context.screenshotDataUrl = screenshotDataUrl;

    // Enrich with any error that came from the trigger
    if (opts?.error) {
      context.error = {
        message: opts.error.message || String(opts.error),
        stack: opts.error.stack ? String(opts.error.stack).slice(0, 1800) : undefined,
      };
    }

    const payload = {
      shortDescription: shortDesc.trim(),
      details: details.trim(),
      severity,
      url: context.url,
      capturedAt: context.capturedAt,
      context, // full logs + viewport + extra
      userAgent: context.userAgent,
    };

    const res = await submitBugReport(payload, token);
    setSubmitting(false);

    if (res.ok) {
      const ref = res.data?.id || res.data?.row || "registrado";
      setResult({ ok: true, ref });
      addBugLog("info", "bug report submitted successfully", { ref });
    } else {
      setResult({ ok: false, error: res.error || "Error desconocido" });
      addBugLog("error", "bug report submit failed", { error: res.error });
    }
  };

  if (!open) return null;

  const ctx = captureBugContext(opts?.extra || {});
  const recentSample = (ctx.logs || []).slice(-5).reverse();

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget && !submitting) close(); }}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          🐛 <span>Reportar problema / bug</span>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit}>
            <div style={bodyStyle}>
              <div>
                <div style={labelStyle}>Descripción corta (obligatorio)</div>
                <input
                  style={inputStyle}
                  placeholder="Ej: Al hacer quote-batch en Wolfboard se queda en loading"
                  value={shortDesc}
                  onChange={(e) => setShortDesc(e.target.value)}
                  disabled={submitting}
                  autoFocus
                />
              </div>

              <div>
                <div style={labelStyle}>Detalles / pasos para reproducir (opcional)</div>
                <textarea
                  style={textareaStyle}
                  placeholder="Qué hiciste justo antes? ¿Apareció algún mensaje de error?"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
                <div>
                  <div style={labelStyle}>Severidad</div>
                  <select
                    style={selectStyle}
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    disabled={submitting}
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica (bloquea trabajo)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowContext((s) => !s)}
                  style={{ ...btnGhost, fontSize: 12, padding: "6px 10px" }}
                >
                  {showContext ? "Ocultar" : "Ver"} datos capturados ({(ctx.logs || []).length} eventos)
                </button>
                <button
                  type="button"
                  onClick={handleCaptureScreenshot}
                  disabled={capturingShot || !!screenshotDataUrl}
                  style={{ ...btnGhost, fontSize: 12, padding: "6px 10px", marginLeft: 8 }}
                  title="Captura simple de la vista actual (se sube al reportar si hay bucket GCS)"
                >
                  {capturingShot ? "Capturando..." : screenshotDataUrl ? "✓ Captura lista" : "📷 Capturar pantalla"}
                </button>
              </div>

              {showContext && (
                <div style={{
                  background: "#f8f8fa",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 11,
                  maxHeight: 160,
                  overflow: "auto",
                }}>
                  <div style={smallMuted}>Ruta: <code>{ctx.url}</code></div>
                  <div style={smallMuted}>Navegador: {ctx.userAgent?.slice(0, 80)}…</div>
                  {recentSample.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={smallMuted}>Últimos eventos capturados:</div>
                      <pre style={{ margin: "4px 0 0", fontSize: 10, whiteSpace: "pre-wrap" }}>
                        {recentSample.map((l) => (
                          `${new Date(l.t).toLocaleTimeString()} [${l.level}] ${l.message}\n`
                        )).join("")}
                      </pre>
                    </div>
                  )}
                  <div style={{ ...smallMuted, marginTop: 6 }}>Se incluirán los logs completos + contexto de la pantalla.</div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button type="submit" style={btnPrimary} disabled={submitting || !shortDesc.trim()}>
                  {submitting ? "Enviando..." : "Enviar reporte"}
                </button>
                <button type="button" style={btnGhost} onClick={close} disabled={submitting}>
                  Cancelar
                </button>
              </div>

              <div style={smallMuted}>
                El reporte incluye automáticamente la ruta, logs recientes de la sesión y datos de la pantalla actual.
                Se guarda en nuestra planilla de seguimiento.
              </div>
            </div>
          </form>
        ) : result.ok ? (
          <div style={bodyStyle}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#0a7d3a" }}>
              ¡Gracias! Reporte registrado.
            </div>
            <div style={smallMuted}>
              Referencia: <strong>{result.ref}</strong><br />
              El equipo lo verá en el tablero de seguimiento y lo priorizará según severidad.
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="button" style={btnPrimary} onClick={close}>Cerrar</button>
            </div>
          </div>
        ) : (
          <div style={bodyStyle}>
            <div style={{ color: "#c0392b", fontWeight: 600 }}>No se pudo enviar el reporte</div>
            <div style={smallMuted}>{result.error}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 10 }}>
              <button type="button" style={btnPrimary} onClick={handleSubmit} disabled={submitting}>
                Reintentar
              </button>
              <button type="button" style={btnGhost} onClick={close}>Cerrar</button>
            </div>
            <div style={{ ...smallMuted, marginTop: 8 }}>
              Como alternativa podés copiar la descripción y pegarla en el chat del equipo o en Wolfboard.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Also re-export openBugReport for convenience in other files
// eslint-disable-next-line react-refresh/only-export-components -- helper colocated with modal by design; moving it would fragment the API
export { openBugReport };
