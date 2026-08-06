/**
 * P5b — list cloud drafts and open one.
 */
import { useEffect, useState } from "react";
import { getCalcApiBase } from "../../utils/calcApiBase.js";
import { ENV_T as T } from "../../utils/enviosTheme.js";
import { btnStyle } from "../../utils/logistica/btnStyle.js";

/**
 * @param {{
 *   token: string,
 *   open: boolean,
 *   onClose: () => void,
 *   onLoad: (draftId: string) => void,
 * }} props
 */
export default function EnviosDraftBrowser({ token, open, onClose, onLoad }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const base = getCalcApiBase();
        const res = await fetch(`${base}/api/envios/drafts?limit=25`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j.ok === false) throw new Error(j.error || res.statusText);
        if (!cancelled) setRows(Array.isArray(j.drafts) ? j.drafts : []);
      } catch (e) {
        if (!cancelled) setErr(e.message || "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.4)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: T.surface,
          borderRadius: 14,
          maxWidth: 480,
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
          padding: 16,
          boxShadow: T.shadow,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: T.brand }}>Borradores en nube</h3>
          <button type="button" onClick={onClose} style={btnStyle({ outline: true, small: true })}>
            Cerrar
          </button>
        </div>
        {loading ? <div style={{ fontSize: 13, color: T.muted }}>Cargando…</div> : null}
        {err ? <div style={{ fontSize: 12, color: T.danger, marginBottom: 8 }}>{err}</div> : null}
        {!loading && !rows.length && !err ? (
          <div style={{ fontSize: 13, color: T.muted }}>No hay drafts guardados.</div>
        ) : null}
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onLoad(d.id || d.env_no)}
              style={{
                textAlign: "left",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "10px 12px",
                background: T.surfaceAlt,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 700, color: T.brand }}>{d.env_no || d.id}</div>
              <div style={{ fontSize: 11, color: T.muted }}>
                rev {d.revision ?? "—"} · {d.stop_count != null ? `${d.stop_count} paradas` : ""} ·{" "}
                {d.updated_at ? new Date(d.updated_at).toLocaleString() : ""}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
