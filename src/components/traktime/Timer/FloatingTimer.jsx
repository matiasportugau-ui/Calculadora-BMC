import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tkApi } from "../shared/api.js";
import { button, colors, dot, formatHms, input } from "../shared/styles.js";
import { onTimerChanged, postTimerChanged } from "../shared/timerChannel.js";

/**
 * Compact, self-contained timer for the detachable widget (Document PiP or a
 * popup window). Loads its own projects so it works standalone, and stays in
 * sync with the main module via the BroadcastChannel in shared/timerChannel.
 *
 * `embedded` (default false): when true it renders without the outer frame,
 * for mounting inside a PiP document body.
 */
export default function FloatingTimer({ embedded = false }) {
  const [running, setRunning] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pollRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const r = await tkApi.timerCurrent();
      setRunning(r.running);
      setError("");
    } catch (e) {
      setError(e.message || "load_failed");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await tkApi.listProjects();
        setProjects(r.projects || []);
      } catch {
        /* projects optional for stop-only use */
      }
    })();
    refresh();
    pollRef.current = setInterval(refresh, 15000);
    const off = onTimerChanged(refresh);
    return () => {
      clearInterval(pollRef.current);
      off();
    };
  }, [refresh]);

  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return undefined;
    }
    const tick = () => {
      const start = new Date(running.started_at).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running]);

  const liveProject = useMemo(
    () => projects.find((p) => p.project_id === running?.project_id),
    [projects, running],
  );

  async function start() {
    if (!projectId) {
      setError("Elegí un proyecto");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await tkApi.timerStart({ project_id: projectId });
      const p = projects.find((x) => x.project_id === projectId);
      setRunning({ ...r.entry, project_name: p?.name, color_hex: p?.color_hex });
      postTimerChanged();
    } catch (e) {
      setError(e.message || "start_failed");
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    setError("");
    try {
      await tkApi.timerStop();
      setRunning(null);
      postTimerChanged();
    } catch (e) {
      setError(e.message || "stop_failed");
    } finally {
      setBusy(false);
    }
  }

  const frame = embedded
    ? {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 14,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        background: colors.bg || "#fff",
        color: colors.text || "#1d1d1f",
        minHeight: "100vh",
        boxSizing: "border-box",
      }
    : {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 14,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        background: colors.bg || "#fff",
      };

  return (
    <div style={frame}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontSize: 34, fontWeight: 300, fontVariantNumeric: "tabular-nums" }}>
          {formatHms(elapsed)}
        </div>
        <div style={{ color: colors.textMuted, fontSize: 12, lineHeight: 1.3 }}>
          {running ? (
            <>
              <span style={dot(running.color_hex || liveProject?.color_hex)} />
              {running.project_name || liveProject?.name || "Proyecto"}
            </>
          ) : (
            "Sin temporizador activo"
          )}
        </div>
      </div>

      {!running ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={{ ...input, flex: 1, minWidth: 140 }}
          >
            <option value="">Proyecto…</option>
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.client_name ? `${p.client_name} — ` : ""}
                {p.name}
              </option>
            ))}
          </select>
          <button disabled={busy} onClick={start} style={button("primary")}>
            ▶
          </button>
        </div>
      ) : (
        <button disabled={busy} onClick={stop} style={button("danger")}>
          ■ Detener
        </button>
      )}

      {error ? <div style={{ color: colors.danger, fontSize: 12 }}>{error}</div> : null}
    </div>
  );
}
