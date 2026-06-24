import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CockpitTokenPanel from "./CockpitTokenPanel.jsx";
import { useCockpitOperatorAuth } from "../hooks/useCockpitOperatorAuth.js";
import { cockpitOperatorFetch } from "../utils/cockpitOperatorFetch.js";

const wrap = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "#f5f5f7",
};

const main = {
  flex: 1,
  padding: "24px 20px 48px",
  maxWidth: 1100,
  margin: "0 auto",
  width: "100%",
  boxSizing: "border-box",
};

const h1 = {
  margin: "0 0 8px",
  fontSize: 24,
  fontWeight: 700,
  color: "#1a3a5c",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif",
};

const sub = {
  margin: "0 0 20px",
  fontSize: 14,
  color: "#6e6e73",
  fontFamily: h1.fontFamily,
  lineHeight: 1.45,
};

const card = {
  background: "#fff",
  borderRadius: 12,
  border: "1px solid #e5e5ea",
  padding: 16,
  marginBottom: 16,
  fontFamily: h1.fontFamily,
};

const rowActions = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
};

const btnPrimary = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "none",
  background: "#25d366",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: h1.fontFamily,
};

const btnGhost = {
  ...btnPrimary,
  background: "#fff",
  color: "#1d1d1f",
  border: "1.5px solid #e5e5ea",
};

const input = {
  width: "100%",
  maxWidth: 420,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1.5px solid #e5e5ea",
  fontSize: 13,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  boxSizing: "border-box",
};

const tableWrap = { overflowX: "auto" };

const table = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
  fontFamily: h1.fontFamily,
};

const th = {
  textAlign: "left",
  padding: "8px 6px",
  borderBottom: "2px solid #e5e5ea",
  color: "#6e6e73",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const td = {
  padding: "10px 6px",
  borderBottom: "1px solid #f0f0f2",
  verticalAlign: "top",
  maxWidth: 220,
  wordBreak: "break-word",
};

async function cockpitFetch(token, path, options = {}) {
  return cockpitOperatorFetch(token, path, options);
}

export default function BmcWaOperativoModule() {
  const {
    token,
    tokenAutoLoaded,
    tokenLoadError,
    tokenInput,
    setTokenInput,
    saveToken,
    clearToken,
    isJwt,
    login,
    user,
  } = useCockpitOperatorAuth({ module: "canales", minLevel: "write" });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  };

  const loadQueue = useCallback(async () => {
    if (!token) {
      setError("Guardá el API token para cargar la cola.");
      return;
    }
    setLoading(true);
    setError("");
    const { ok, status, data } = await cockpitFetch(token, "/api/crm/cockpit/wa-queue");
    setLoading(false);
    if (!ok) {
      // Top-20 run 2026-05-11 (#L4): mensajes accionables para 401/403/503.
      let msg;
      if (status === 401) {
        msg = "Sesión inválida o expirada. Iniciá sesión de nuevo con Google.";
      } else if (status === 403) {
        msg = "El token no tiene permisos para esta cola. Avisá a Matías para revisar el alcance.";
      } else if (status === 503 && data?.code === "ENV_MISSING") {
        msg = `Servidor sin configurar (${data.envVar}). Revisá Cloud Run env o .env local.`;
      } else {
        msg = data?.error || `HTTP ${status}`;
      }
      setError(msg);
      setItems([]);
      return;
    }
    setItems(Array.isArray(data.items) ? data.items : []);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setItems([]);
      return;
    }
    loadQueue();
  }, [token, loadQueue]);

  const approveRow = async (row) => {
    if (!token) return;
    const { ok, data } = await cockpitFetch(token, "/api/crm/cockpit/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row, approved: true }),
    });
    if (!ok) {
      showToast(data?.error || "No se pudo aprobar");
      return;
    }
    showToast(`Fila ${row}: aprobado enviar.`);
    await loadQueue();
  };

  const sendRow = async (row) => {
    if (!token) return;
    const { ok, data } = await cockpitFetch(token, "/api/crm/cockpit/send-approved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row }),
    });
    if (!ok) {
      showToast(data?.error || "No se pudo enviar");
      return;
    }
    showToast(`Fila ${row}: enviado (${data.channel || "ok"}).`);
    await loadQueue();
  };

  const copyText = async (text, label) => {
    const t = String(text || "").trim();
    if (!t) {
      showToast("Nada para copiar");
      return;
    }
    try {
      await navigator.clipboard.writeText(t);
      showToast(`${label} copiado`);
    } catch {
      showToast("No se pudo copiar (permiso del navegador)");
    }
  };

  return (
    <div style={wrap}>
      <div style={main}>
        <p style={{ margin: "0 0 8px" }}>
          <Link
            to="/hub"
            style={{
              fontSize: 13,
              color: "#0071e3",
              textDecoration: "none",
              fontFamily: h1.fontFamily,
              fontWeight: 600,
            }}
          >
            ← Wolfboard
          </Link>
        </p>
        <h1 style={h1}>WhatsApp · Operativo</h1>
        <p style={sub}>
          Cola desde CRM_Operativo (filas con origen <strong>WA</strong> / WhatsApp). Aprobá (AI) y enviá
          con el texto de AF vía WhatsApp Cloud API.
        </p>

        <div style={card}>
          <CockpitTokenPanel
            tokenAutoLoaded={tokenAutoLoaded}
            tokenLoadError={tokenLoadError}
            tokenInput={tokenInput}
            setTokenInput={setTokenInput}
            onSave={saveToken}
            onClear={clearToken}
            isJwt={isJwt}
            userEmail={user?.email || ""}
            onLogin={login}
            inputStyle={input}
            btnPrimaryStyle={{ ...btnGhost, border: "1.5px solid #25d366" }}
            btnGhostStyle={btnGhost}
            actions={
              <button type="button" style={btnGhost} onClick={loadQueue} disabled={loading || !token}>
                {loading ? "Cargando…" : "Actualizar cola"}
              </button>
            }
          />
        </div>

        {error ? (
          <div
            style={{
              ...card,
              borderColor: "#ffccd0",
              background: "#fff5f5",
              color: "#8b0000",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        ) : null}

        {toast ? (
          <div
            style={{
              position: "fixed",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#1d1d1f",
              color: "#fff",
              padding: "10px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontFamily: h1.fontFamily,
              zIndex: 50,
              maxWidth: "90vw",
            }}
          >
            {toast}
          </div>
        ) : null}

        <div style={card}>
          <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 600 }}>Cola WA ({items.length})</div>
          {items.length === 0 && !loading ? (
            <p style={{ margin: 0, fontSize: 13, color: "#6e6e73" }}>
              No hay filas WA o aún no cargaste el token.
            </p>
          ) : (
            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Fila</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>Teléfono</th>
                    <th style={th}>Consulta</th>
                    <th style={th}>AF</th>
                    <th style={th}>AI</th>
                    <th style={th}>AJ</th>
                    <th style={th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ row, parsed }) => (
                    <tr key={row}>
                      <td style={td}>{row}</td>
                      <td style={td}>{parsed.estado || "—"}</td>
                      <td style={td}>{parsed.cliente || "—"}</td>
                      <td style={{ ...td, whiteSpace: "nowrap" }}>{parsed.telefono || "—"}</td>
                      <td style={td}>{(parsed.consulta || "").slice(0, 180)}</td>
                      <td style={td}>{(parsed.respuestaSugerida || "").slice(0, 120)}</td>
                      <td style={td}>{parsed.aprobadoEnviar || "—"}</td>
                      <td style={{ ...td, maxWidth: 100 }}>{(parsed.enviadoEl || "").slice(0, 24)}</td>
                      <td style={{ ...td, maxWidth: 280 }}>
                        <div style={rowActions}>
                          <button
                            type="button"
                            style={btnGhost}
                            onClick={() => copyText(parsed.respuestaSugerida, "AF")}
                          >
                            Copiar AF
                          </button>
                          <button type="button" style={btnGhost} onClick={() => approveRow(row)}>
                            Aprobar
                          </button>
                          <button type="button" style={btnPrimary} onClick={() => sendRow(row)}>
                            Enviar WA
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
