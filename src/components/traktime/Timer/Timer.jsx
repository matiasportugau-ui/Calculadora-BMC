import { useEffect, useMemo, useRef, useState } from "react";
import { tkApi } from "../shared/api.js";
import { button, card, colors, dot, formatHms, input } from "../shared/styles.js";

export default function Timer({ projects, onChange }) {
  const [running, setRunning] = useState(null);
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef(null);

  async function refresh() {
    try {
      const r = await tkApi.timerCurrent();
      setRunning(r.running);
      setError("");
    } catch (e) {
      setError(e.message || "load_failed");
    }
  }

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 30000);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
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
      setError("Selecciona un proyecto");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await tkApi.timerStart({ project_id: projectId, description });
      setRunning({ ...r.entry, project_name: liveProject?.name, color_hex: liveProject?.color_hex });
      setDescription("");
      onChange?.();
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
      onChange?.();
    } catch (e) {
      setError(e.message || "stop_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <div style={{ fontSize: 48, fontWeight: 300, fontVariantNumeric: "tabular-nums" }}>
          {formatHms(elapsed)}
        </div>
        {running ? (
          <div style={{ color: colors.textMuted, fontSize: 14 }}>
            <span style={dot(running.color_hex || liveProject?.color_hex)} />
            {running.project_name || liveProject?.name || "Proyecto"}
            {running.description ? ` — ${running.description}` : ""}
          </div>
        ) : (
          <div style={{ color: colors.textMuted, fontSize: 14 }}>Sin temporizador activo</div>
        )}
      </div>

      {!running ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={{ ...input, minWidth: 220 }}
          >
            <option value="">Selecciona proyecto…</option>
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.client_name ? `${p.client_name} — ` : ""}
                {p.name}
              </option>
            ))}
          </select>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="¿En qué estás trabajando?"
            style={{ ...input, flex: 1, minWidth: 240 }}
          />
          <button disabled={busy} onClick={start} style={button("primary")}>
            ▶ Empezar
          </button>
        </div>
      ) : (
        <div>
          <button disabled={busy} onClick={stop} style={button("danger")}>
            ■ Detener
          </button>
        </div>
      )}

      {error ? <div style={{ color: colors.danger, fontSize: 13 }}>{error}</div> : null}
    </div>
  );
}
