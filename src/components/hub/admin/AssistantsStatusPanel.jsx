// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/admin/AssistantsStatusPanel.jsx — /hub/admin/assistants.
// ───────────────────────────────────────────────────────────────────────────
// Live status of the AI Assistant control plane. Polls /api/assistants/status
// (~15s) and shows, per assistant: enabled/health badge, the provider currently
// serving, and its fallback target. Mirrors the admin-analytics pattern
// (useBmcAuth token, .adminCot / --ac-* tokens, no new deps).
// ═══════════════════════════════════════════════════════════════════════════

import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { SkinProvider, useSkin } from "../../admin-cotizaciones/SkinProvider.jsx";
import "../../admin-cotizaciones/styles.css";
import { useBmcAuth } from "../../../hooks/useBmcAuth.js";

const ApiBase = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
  }
  return "";
})();

const POLL_MS = 15_000;

const STATUS_META = {
  live: { color: "#1a7f37", bg: "#dafbe1", label: "LIVE" },
  degraded: { color: "#9a6700", bg: "#fff8c5", label: "DEGRADED" },
  disabled: { color: "#57606a", bg: "#eaeef2", label: "DISABLED" },
  down: { color: "#cf222e", bg: "#ffebe9", label: "DOWN" },
};

async function jget(token, path) {
  const r = await fetch(`${ApiBase}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return r.json();
}

async function jpost(token, path, body) {
  const r = await fetch(`${ApiBase}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let detail = `http_${r.status}`;
    try {
      const j = await r.json();
      detail = j?.error || detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  return r.json();
}

function Badge({ status }) {
  const m = STATUS_META[status] || STATUS_META.down;
  return (
    <span
      style={{
        color: m.color, background: m.bg, borderRadius: 6, padding: "2px 8px",
        fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
      }}
    >
      {m.label}
    </span>
  );
}

function PanelInner() {
  useSkin();
  const auth = useBmcAuth();
  const token = auth?.accessToken;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState(null);

  const refresh = useCallback(
    async (force = false) => {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await jget(token, `/api/assistants/status${force ? "?deep=1" : ""}`);
        setData(res);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  // Runtime enable/disable — persisted via POST /api/assistants/:key/toggle
  // (admin-gated, no redeploy). Refetch after so the badge reflects the change.
  const toggleAssistant = useCallback(
    async (key, nextEnabled) => {
      if (!token) return;
      setBusyKey(key);
      setError(null);
      try {
        await jpost(token, `/api/assistants/${key}/toggle`, { enabled: nextEnabled });
        await refresh(false);
      } catch (e) {
        setError(`No se pudo ${nextEnabled ? "encender" : "apagar"} '${key}': ${String(e?.message || e)}`);
      } finally {
        setBusyKey(null);
      }
    },
    [token, refresh],
  );

  useEffect(() => {
    refresh();
    const id = setInterval(() => refresh(false), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const providers = data?.providers;

  return (
    <div className="adminCot" style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Asistentes IA — estado</h1>
          <div style={{ fontSize: 13, color: "#57606a", marginTop: 4 }}>
            Plano de control · activos:{" "}
            <strong>{data?.active?.join(", ") || "—"}</strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ac-btn" onClick={() => refresh(false)} disabled={loading}>
            {loading ? "Actualizando…" : "Refrescar"}
          </button>
          <button className="ac-btn" onClick={() => refresh(true)} disabled={loading} title="Ignora la caché de 30s">
            Deep check
          </button>
          <Link className="ac-btn" to="/hub/admin/analytics">Analytics</Link>
        </div>
      </div>

      {error && (
        <div style={{ color: "#cf222e", background: "#ffebe9", padding: 12, borderRadius: 8, marginBottom: 12 }}>
          Error: {error}
        </div>
      )}

      {providers && (
        <div style={{ fontSize: 13, color: "#57606a", marginBottom: 16 }}>
          Proveedores disponibles:{" "}
          <strong>{providers.available?.length ? providers.available.join(" → ") : "ninguno (faltan API keys)"}</strong>
          {" · "}cadena de fallback: {providers.chain?.join(" → ") || "—"}
        </div>
      )}

      {providers?.cooldowns &&
        Object.entries(providers.cooldowns).some(([, c]) => c.recentFailures > 0 || c.lastError) && (
          <div style={{ background: "#fff8c5", border: "1px solid #d4a72c", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: "#7a5c00", marginBottom: 6 }}>
              ⚠ Proveedores con fallas reales (no solo presencia de key)
            </div>
            {Object.entries(providers.cooldowns)
              .filter(([, c]) => c.recentFailures > 0 || c.lastError)
              .map(([p, c]) => (
                <div key={p} style={{ color: "#57606a", marginTop: 3 }}>
                  <strong>{p}</strong>
                  {c.coolingDown ? " · en cooldown" : ""}
                  {c.recentFailures ? ` · ${c.recentFailures} fallo(s) recientes` : ""}
                  {c.lastError && (
                    <>
                      {" · "}
                      <span style={{ fontFamily: "monospace" }}>{c.lastError.status ?? "err"}</span>
                      {c.lastError.detail ? ` ${String(c.lastError.detail).slice(0, 120)}` : ""}
                      {c.lastError.at ? ` (${new Date(c.lastError.at).toLocaleTimeString()})` : ""}
                      {[400, 401, 403].includes(Number(c.lastError.status)) && (
                        <div style={{ fontSize: 12, color: "#7a5c00", marginTop: 2 }}>
                          → Credencial/billing (owner): revisar créditos/API key del proveedor
                          {p === "claude" ? " (Anthropic Plans & Billing)" : ""}
                          {p === "grok" ? " (GCP Secret Manager · GROK_API_KEY + redeploy)" : ""}
                          {" — no se auto-resuelve desde el panel."}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
          </div>
        )}

      <div style={{ display: "grid", gap: 10 }}>
        {(data?.assistants || []).map((a) => (
          <div
            key={a.key}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              gap: 12,
              alignItems: "center",
              border: "1px solid #d0d7de",
              borderRadius: 10,
              padding: "12px 16px",
              background: "#fff",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>
                {a.label}{" "}
                <span style={{ fontSize: 12, color: "#8c959f" }}>({a.key})</span>
              </div>
              <div style={{ fontSize: 12, color: "#57606a", marginTop: 3 }}>
                {a.activeProvider ? <>sirviendo vía <strong>{a.activeProvider}</strong> · </> : null}
                {a.fallbackTo ? <>fallback → {a.fallbackTo}</> : "terminal (sin fallback)"}
                {a.detail ? <> · {a.detail}</> : null}
              </div>
            </div>
            {a.key === "seam" ? (
              <span style={{ fontSize: 11, color: "#8c959f", whiteSpace: "nowrap" }}>siempre on</span>
            ) : (
              <button
                className="ac-btn"
                onClick={() => toggleAssistant(a.key, !a.enabled)}
                disabled={busyKey === a.key || !token}
                title={a.enabled ? "Apagar este asistente (sin redeploy)" : "Encender este asistente (sin redeploy)"}
                style={{ minWidth: 96, fontSize: 12, whiteSpace: "nowrap" }}
              >
                {busyKey === a.key ? "…" : a.enabled ? "Apagar" : "Encender"}
              </button>
            )}
            <Badge status={a.status} />
          </div>
        ))}
      </div>

      {data?.generatedAt && (
        <div style={{ fontSize: 11, color: "#8c959f", marginTop: 16 }}>
          Última verificación: {new Date(data.generatedAt).toLocaleTimeString()} · auto-refresh {POLL_MS / 1000}s
        </div>
      )}
    </div>
  );
}

export default function AssistantsStatusPanel() {
  return (
    <SkinProvider>
      <PanelInner />
    </SkinProvider>
  );
}
