import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import CockpitTokenPanel from "./CockpitTokenPanel.jsx";

const STORAGE_KEY = "bmc_cockpit_token";

const wrap = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  background: "#f5f5f7",
};

const main = {
  flex: 1,
  padding: "24px 20px 48px",
  maxWidth: 1280,
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
  background: "#0071e3",
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

const linkInput = {
  minWidth: 140,
  maxWidth: 220,
  padding: "6px 8px",
  borderRadius: 8,
  border: "1.5px solid #e5e5ea",
  fontSize: 11,
  fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
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
  maxWidth: 200,
  wordBreak: "break-word",
};

const CHANNEL_LABEL = {
  mercadolibre: "Mercado Libre",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
};

function getStoredToken() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function setStoredToken(t) {
  try {
    if (t) localStorage.setItem(STORAGE_KEY, t);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

async function cockpitFetch(token, path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function BmcCanalesUnificadosModule() {
  const [tokenInput, setTokenInput] = useState("");
  const [token, setToken] = useState("");
  const [items, setItems] = useState([]);
  const [linkDraftByRow, setLinkDraftByRow] = useState({});
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [tokenLoadError, setTokenLoadError] = useState("");
  const [tokenAutoLoaded, setTokenAutoLoaded] = useState(false);
  const [channelTab, setChannelTab] = useState("all");

  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      setTokenInput(stored);
      setToken(stored);
      setTokenAutoLoaded(true);
      return;
    }
    const base = getCalcApiBase();
    const url = `${base.replace(/\/+$/, "")}/api/crm/cockpit-token`;
    fetch(url, { credentials: "omit" })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data?.ok) {
          setTokenLoadError(
            `No se pudo cargar el token del servidor (${data?.error || `HTTP ${r.status}`}). Pegá API_AUTH_TOKEN manualmente.`,
          );
          return;
        }
        const t = String(data?.token || "").trim();
        if (t) {
          setStoredToken(t);
          setTokenInput(t);
          setToken(t);
          setTokenAutoLoaded(true);
          setTokenLoadError("");
        } else {
          setTokenLoadError("El servidor no devolvió token. Pegá API_AUTH_TOKEN manualmente.");
        }
      })
      .catch(() => {
        setTokenLoadError("Error de red al pedir el token. Pegá API_AUTH_TOKEN manualmente.");
      });
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4200);
  };

  const loadQueue = useCallback(async () => {
    if (!token) {
      setError("Guardá el API token para cargar la cola.");
      return;
    }
    setLoading(true);
    setError("");
    const q = channelTab === "all" ? "" : `?channel=${encodeURIComponent(channelTab)}`;
    const { ok, status, data } = await cockpitFetch(token, `/api/crm/cockpit/unified-queue${q}`);
    setLoading(false);
    if (!ok) {
      setError(data?.error || `HTTP ${status}`);
      setItems([]);
      return;
    }
    const list = Array.isArray(data.items) ? data.items : [];
    setItems(list);
    const drafts = {};
    for (const it of list) {
      drafts[it.row] = String(it.parsed?.linkPresupuesto || "").trim();
    }
    setLinkDraftByRow(drafts);
  }, [token, channelTab]);

  useEffect(() => {
    if (!token) {
      setItems([]);
      return;
    }
    loadQueue();
  }, [token, loadQueue]);

  const saveToken = () => {
    const t = tokenInput.trim();
    setStoredToken(t);
    setToken(t);
    if (t) setTokenAutoLoaded(true);
    showToast(t ? "Token guardado." : "Token borrado.");
  };

  const runSyncAll = async () => {
    if (!token) {
      setError("Necesitás el API token.");
      return;
    }
    setSyncing(true);
    setError("");
    const { ok, data } = await cockpitFetch(token, "/api/crm/cockpit/sync-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    setSyncing(false);
    const ml = data?.mercadolibre || {};
    if (!ok && data?.error) {
      setError(String(data.error));
      return;
    }
    const parts = [];
    if (ml.ran) {
      parts.push(ml.error ? `ML: ${ml.error}` : `ML: +${ml.synced ?? 0} nueva(s)`);
    }
    parts.push("WA: webhook en vivo (sin pull)");
    parts.push("FB/IG: sin API pull aún");
    showToast(parts.join(" · "));
    if (data?.ok === false && ml.error) {
      setError(`Sync parcial: ${ml.error}`);
    } else {
      setError("");
    }
    await loadQueue();
  };

  const saveQuoteLink = async (row) => {
    if (!token) return;
    const url = String(linkDraftByRow[row] || "").trim();
    if (!url) {
      showToast("Pegá un link en AH");
      return;
    }
    const { ok, data } = await cockpitFetch(token, "/api/crm/cockpit/quote-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row, url }),
    });
    if (!ok) {
      showToast(data?.error || "No se pudo guardar AH");
      return;
    }
    showToast(`Fila ${row}: link guardado (AH)`);
    await loadQueue();
  };

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

  const sendRow = async (row, channel) => {
    if (!token) return;
    if (channel === "instagram" || channel === "facebook") {
      showToast("Envío automático aún no disponible para IG/FB — copiá AF y respondé en la app.");
      return;
    }
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

  const tabs = [
    { id: "all", label: "Todos" },
    { id: "mercadolibre", label: "ML" },
    { id: "whatsapp", label: "WA" },
    { id: "instagram", label: "IG" },
    { id: "facebook", label: "FB" },
  ];

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
        <h1 style={h1}>Canales · Inbox unificado</h1>
        <p style={sub}>
          Un solo panel para CRM_Operativo: sincronizar preguntas de <strong>Mercado Libre</strong> a la planilla,
          ver <strong>WhatsApp</strong> (ingesta en vivo por webhook) y filas etiquetadas como{" "}
          <strong>Instagram</strong> / <strong>Facebook</strong>. Columna <strong>AF</strong> = respuesta lista para
          copiar; <strong>AH</strong> = link de cotización / PDF.
        </p>

        <div style={card}>
          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600 }}>Sincronizar canales → CRM</div>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#6e6e73", lineHeight: 1.5 }}>
            El botón ejecuta pull de <strong>Mercado Libre</strong> (igual que “Sincronizar ML → CRM”). WhatsApp no
            tiene pull aquí: las conversaciones entran por el webhook de Meta. Facebook e Instagram requieren API
            adicional; si cargás filas manualmente con origen Instagram/Facebook, aparecen en la tabla.
          </p>
          <div style={rowActions}>
            <button type="button" style={btnPrimary} onClick={runSyncAll} disabled={syncing || !token}>
              {syncing ? "Sincronizando…" : "Sincronizar todos (ML + estado WA/FB/IG)"}
            </button>
            <button type="button" style={btnGhost} onClick={loadQueue} disabled={loading || !token}>
              {loading ? "Cargando…" : "Actualizar tabla"}
            </button>
          </div>
        </div>

        <div style={card}>
          <CockpitTokenPanel
            tokenAutoLoaded={tokenAutoLoaded}
            tokenLoadError={tokenLoadError}
            tokenInput={tokenInput}
            setTokenInput={setTokenInput}
            onSave={saveToken}
            onClear={() => { setTokenAutoLoaded(false); setStoredToken(""); setToken(""); setTokenInput(""); }}
            inputStyle={input}
            btnPrimaryStyle={btnPrimary}
            btnGhostStyle={btnGhost}
          />
        </div>

        <div style={{ ...card, padding: "10px 12px" }}>
          <div style={{ ...rowActions, gap: 6 }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setChannelTab(t.id)}
                style={{
                  ...btnGhost,
                  fontSize: 12,
                  padding: "6px 12px",
                  background: channelTab === t.id ? "#e8f2ff" : "#fff",
                  borderColor: channelTab === t.id ? "#0071e3" : "#e5e5ea",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
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
              fontSize: 12,
              fontFamily: h1.fontFamily,
              zIndex: 50,
              maxWidth: "92vw",
            }}
          >
            {toast}
          </div>
        ) : null}

        <div style={card}>
          <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 600 }}>
            Cola unificada ({items.length})
          </div>
          {items.length === 0 && !loading ? (
            <p style={{ margin: 0, fontSize: 13, color: "#6e6e73" }}>
              No hay filas para este filtro. Probá “Sincronizar todos” para ML o revisá origen en la planilla.
            </p>
          ) : (
            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Canal</th>
                    <th style={th}>Fila</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>Consulta</th>
                    <th style={th}>AF (copiar)</th>
                    <th style={th}>AH link cotización</th>
                    <th style={th}>AI</th>
                    <th style={th}>AJ</th>
                    <th style={th}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ row, channel, parsed, questionId }) => (
                    <tr key={`${channel}-${row}`}>
                      <td style={td}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            background:
                              channel === "whatsapp"
                                ? "#dcf8c6"
                                : channel === "mercadolibre"
                                  ? "#e8f2ff"
                                  : "#f2f2f7",
                            color: "#1d1d1f",
                          }}
                        >
                          {CHANNEL_LABEL[channel] || channel}
                        </span>
                        {questionId ? (
                          <div style={{ fontSize: 10, color: "#86868b", marginTop: 4 }}>Q:{questionId}</div>
                        ) : null}
                      </td>
                      <td style={td}>{row}</td>
                      <td style={td}>{parsed.estado || "—"}</td>
                      <td style={td}>{parsed.cliente || "—"}</td>
                      <td style={td}>{(parsed.consulta || "").slice(0, 160)}</td>
                      <td style={td}>{(parsed.respuestaSugerida || "").slice(0, 100)}</td>
                      <td style={{ ...td, maxWidth: 260 }}>
                        <input
                          type="url"
                          placeholder="https://… cotización / PDF"
                          value={linkDraftByRow[row] ?? ""}
                          onChange={(e) =>
                            setLinkDraftByRow((prev) => ({ ...prev, [row]: e.target.value }))
                          }
                          style={linkInput}
                        />
                        <div style={{ ...rowActions, marginTop: 6 }}>
                          <button type="button" style={{ ...btnGhost, fontSize: 11, padding: "4px 8px" }} onClick={() => saveQuoteLink(row)}>
                            Guardar AH
                          </button>
                          {parsed.linkPresupuesto ? (
                            <a
                              href={parsed.linkPresupuesto}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: 11, color: "#0071e3" }}
                            >
                              Abrir
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td style={td}>{parsed.aprobadoEnviar || "—"}</td>
                      <td style={{ ...td, maxWidth: 100 }}>{(parsed.enviadoEl || "").slice(0, 24)}</td>
                      <td style={{ ...td, maxWidth: 300 }}>
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
                          <button
                            type="button"
                            style={channel === "whatsapp" ? { ...btnPrimary, background: "#25d366" } : btnPrimary}
                            onClick={() => sendRow(row, channel)}
                          >
                            {channel === "whatsapp" ? "Enviar WA" : "Enviar"}
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
