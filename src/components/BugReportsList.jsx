import React, { useEffect, useState } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import BmcModuleNav from "./BmcModuleNav.jsx";

const TOKEN_KEY = "bmc_cockpit_token";

function getStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}

async function apiFetch(token, path, options = {}) {
  const base = getCalcApiBase().replace(/\/+$/, "");
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const wrap = { minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f5f5f7" };
const main = { flex: 1, padding: "18px 20px", maxWidth: 1100, margin: "0 auto", width: "100%" };
const h1 = { margin: 0, fontSize: 22, fontWeight: 700, color: "#1a3a5c" };

export default function BugReportsList() {
  const [token] = useState(() => getStoredToken());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null); // id

  const load = async () => {
    if (!token) { setError("Necesitás token de cockpit para ver reportes de bugs."); return; }
    setLoading(true); setError("");
    const { ok, status, data } = await apiFetch(token, "/api/bugs?limit=30");
    setLoading(false);
    if (!ok) { setError(data?.error || `HTTP ${status}`); setItems([]); return; }
    setItems(Array.isArray(data?.data) ? data.data : []);
  };

  useEffect(() => { load(); /* eslint-disable-line */ }, [token]);

  const toggle = (id) => setExpanded(expanded === id ? null : id);

  return (
    <div style={wrap}>
      <BmcModuleNav />
      <div style={main}>
        <h1 style={h1}>🐛 Reportes de bugs recientes</h1>
        <p style={{ color: "#666", fontSize: 13, margin: "4px 0 16px" }}>
          Incluyen logs automáticos de la sesión, ruta, severidad y (si se capturó) URL de screenshot. Datos vienen de la planilla BUG_REPORTS.
        </p>

        {!token && <div style={{ color: "#c0392b", marginBottom: 12 }}>Guardá tu token de cockpit (usá el panel en Wolfboard / Admin cotizaciones).</div>}
        {error && <div style={{ color: "#c0392b", marginBottom: 12 }}>{error}</div>}
        {loading && <div>Cargando...</div>}

        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8f8fa" }}>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>ID / Fecha</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>Severidad</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>Descripción</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #eee" }}>Ruta</th>
              <th style={{ padding: 8, borderBottom: "1px solid #eee" }}></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && <tr><td colSpan={5} style={{ padding: 12, color: "#666" }}>Sin reportes todavía.</td></tr>}
            {items.map((it) => (
              <React.Fragment key={it.id}>
                <tr style={{ borderBottom: "1px solid #f0f0f0", cursor: "pointer" }} onClick={() => toggle(it.id)}>
                  <td style={{ padding: 8, fontFamily: "monospace", fontSize: 11 }}>{it.id}<br /><span style={{ color: "#888" }}>{it.timestamp?.slice(0, 16)}</span></td>
                  <td style={{ padding: 8 }}>
                    <span style={{
                      padding: "2px 6px", borderRadius: 4, fontSize: 11,
                      background: it.severity === "critica" ? "#fee2e2" : it.severity === "alta" ? "#fef3c7" : "#e0f2fe",
                      color: it.severity === "critica" ? "#991b1b" : "#333"
                    }}>{it.severity}</span>
                  </td>
                  <td style={{ padding: 8 }}>{it.shortDescription}</td>
                  <td style={{ padding: 8, fontSize: 11, color: "#555", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>{it.url}</td>
                  <td style={{ padding: 8, textAlign: "right" }}>
                    {it.hasScreenshot && <span title="Tiene captura">📷 </span>}
                    <button style={{ fontSize: 11 }} onClick={(e) => { e.stopPropagation(); toggle(it.id); }}>{expanded === it.id ? "Ocultar" : "Detalles"}</button>
                  </td>
                </tr>
                {expanded === it.id && (
                  <tr>
                    <td colSpan={5} style={{ background: "#fafafa", padding: 12, fontSize: 12 }}>
                      <div><strong>Detalles:</strong> {it.details || "(sin detalles)"}</div>
                      {it.screenshotUrl && <div style={{ marginTop: 6 }}><a href={it.screenshotUrl} target="_blank" rel="noreferrer">Ver captura de pantalla →</a></div>}
                      <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 10, whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto", background: "#fff", padding: 6, border: "1px solid #eee" }}>
                        (Contexto completo + logs disponibles en la fila de la planilla BUG_REPORTS. ID: {it.id})
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
          Refrescá la página o volvé a Wolfboard para nuevos reportes. Los reportes también aparecen como entradas en AUDIT_LOG.
        </div>
      </div>
    </div>
  );
}
