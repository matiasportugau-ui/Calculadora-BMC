/**
 * Coordination browser — open Saved (en coordinación) or Completed coordinations.
 * Sources: Postgres drafts/repartos + Drive .bmc-envios.json
 */
import { useEffect, useState } from "react";
import { getCalcApiBase } from "../../utils/calcApiBase.js";
import { ENV_T as T } from "../../utils/enviosTheme.js";
import { btnStyle } from "../../utils/logistica/btnStyle.js";
import {
  isAuthenticated as gdriveIsAuth,
  listEnviosCoordinations,
  loadEnviosCoordinationFile,
  signIn as gdriveSignIn,
} from "../../utils/googleDrive.js";

/**
 * @param {{
 *   token: string,
 *   open: boolean,
 *   initialTab?: "saved"|"completed",
 *   onClose: () => void,
 *   onLoad: (sel: {
 *     source: "draft"|"reparto"|"drive",
 *     id: string,
 *     status?: string,
 *     doc?: object,
 *   }) => void,
 *   rootFolderId?: string|null,
 * }} props
 */
export default function EnviosDraftBrowser({
  token,
  open,
  initialTab = "saved",
  onClose,
  onLoad,
  rootFolderId = null,
}) {
  const [tab, setTab] = useState(initialTab);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setTab(initialTab === "completed" ? "completed" : "saved");
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      const next = [];
      try {
        const base = getCalcApiBase();
        if (token) {
          if (tab === "saved") {
            const res = await fetch(`${base}/api/envios/drafts?limit=25`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const j = await res.json().catch(() => ({}));
            if (res.ok && j.ok !== false) {
              for (const d of j.drafts || []) {
                next.push({
                  key: `draft:${d.id}`,
                  source: "draft",
                  id: d.id || d.env_no,
                  title: d.env_no || d.id,
                  subtitle: `Borrador nube · rev ${d.revision ?? "—"} · ${d.stop_count ?? "?"} paradas`,
                  updatedAt: d.updated_at,
                  status: "saved",
                });
              }
            }
            const rRes = await fetch(`${base}/api/repartos?status=en_coordinacion&limit=25`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const rj = await rRes.json().catch(() => ({}));
            if (rRes.ok && rj.ok) {
              for (const r of rj.repartos || []) {
                next.push({
                  key: `reparto:${r.id}`,
                  source: "reparto",
                  id: r.id || r.reparto_no,
                  title: r.reparto_no || r.id,
                  subtitle: `En coordinación · ${r.stop_count ?? "?"} paradas · camión ${r.truck_l || "—"}m`,
                  updatedAt: r.updated_at,
                  status: "saved",
                });
              }
            }
          } else {
            const rRes = await fetch(`${base}/api/repartos?status=coordinado&limit=30`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const rj = await rRes.json().catch(() => ({}));
            if (rRes.ok && rj.ok) {
              for (const r of rj.repartos || []) {
                next.push({
                  key: `reparto:${r.id}`,
                  source: "reparto",
                  id: r.id || r.reparto_no,
                  title: r.reparto_no || r.id,
                  subtitle: `Completada · ${r.stop_count ?? "?"} paradas · ${r.confirmed_at ? new Date(r.confirmed_at).toLocaleDateString() : ""}`,
                  updatedAt: r.updated_at || r.confirmed_at,
                  status: "completed",
                });
              }
            }
          }
        }

        try {
          if (!gdriveIsAuth()) {
            // optional — don't block cloud list
          } else {
            const driveRows = await listEnviosCoordinations({
              rootFolderId,
              status: tab === "completed" ? "completed" : "saved",
            });
            for (const f of driveRows) {
              next.push({
                key: `drive:${f.id}`,
                source: "drive",
                id: f.id,
                title: f.envNo || f.name,
                subtitle: `Drive · ${f.status === "completed" ? "Completada" : "Guardada"} · ${f.name}`,
                updatedAt: f.modifiedTime,
                status: f.status,
              });
            }
          }
        } catch (driveErr) {
          if (!next.length) throw driveErr;
          if (!cancelled) {
            setErr(`Drive: ${driveErr.message || "error"} (mostrando nube)`);
          }
        }

        next.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
        if (!cancelled) setRows(next);
      } catch (e) {
        if (!cancelled) setErr(e.message || "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, token, tab, rootFolderId]);

  if (!open) return null;

  async function handlePick(row) {
    if (row.source === "drive") {
      try {
        if (!gdriveIsAuth()) await gdriveSignIn();
        const doc = await loadEnviosCoordinationFile(row.id);
        onLoad({ source: "drive", id: row.id, status: row.status, doc });
      } catch (e) {
        setErr(e.message || "No se pudo abrir de Drive");
      }
      return;
    }
    onLoad({ source: row.source, id: row.id, status: row.status });
  }

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
          maxWidth: 520,
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
          padding: 16,
          boxShadow: T.shadow,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: T.brand }}>Coordinaciones</h3>
          <button type="button" onClick={onClose} style={btnStyle({ outline: true, small: true })}>
            Cerrar
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[
            ["saved", "Guardadas"],
            ["completed", "Completadas"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: tab === id ? `2px solid ${T.primary || "#2563eb"}` : `1px solid ${T.border}`,
                background: tab === id ? "#eff6ff" : T.surfaceAlt,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>
          Nube (borradores / repartos) + Drive (carpeta «BMC Envíos Coordinaciones»). Formato reanudable desde Logística o Calculadora.
        </div>

        {!token ? (
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>
            Sin token API — solo se listan archivos de Drive si estás conectado.
          </div>
        ) : null}

        {loading ? <div style={{ fontSize: 13, color: T.muted }}>Cargando…</div> : null}
        {err ? <div style={{ fontSize: 12, color: T.danger, marginBottom: 8 }}>{err}</div> : null}
        {!loading && !rows.length && !err ? (
          <div style={{ fontSize: 13, color: T.muted }}>
            {tab === "completed" ? "No hay coordinaciones completadas." : "No hay coordinaciones guardadas."}
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => handlePick(d)}
              style={{
                textAlign: "left",
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                padding: "10px 12px",
                background: T.surfaceAlt,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 700, color: T.brand }}>{d.title}</div>
              <div style={{ fontSize: 11, color: T.muted }}>
                {d.subtitle}
                {d.updatedAt ? ` · ${new Date(d.updatedAt).toLocaleString()}` : ""}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
