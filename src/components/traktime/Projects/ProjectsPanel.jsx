import { useEffect, useState } from "react";
import { tkApi } from "../shared/api.js";
import { button, card, colors, dot, input } from "../shared/styles.js";
import UserCombobox from "../../admin/users/UserCombobox.jsx";
import { useBmcAuth } from "../../../hooks/useBmcAuth.js";

const ROUNDING_OPTS = [1, 5, 15, 30, 60];

export default function ProjectsPanel({ canEdit, onChange }) {
  const auth = useBmcAuth();
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [members, setMembers] = useState({}); // project_id -> [members]
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    client_id: "",
    name: "",
    color_hex: "#0071e3",
    hourly_rate_usd: 0,
    rounding_minutes: 15,
  });
  // memberDraft now only holds the role per project; user_id arrives from UserCombobox
  const [memberDraft, setMemberDraft] = useState({});

  async function loadAll() {
    try {
      const [pr, cl] = await Promise.all([tkApi.listProjects(), tkApi.listClients()]);
      setProjects(pr.projects || []);
      setClients(cl.clients || []);
      setError("");
    } catch (e) {
      setError(e.message || "load_failed");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function loadMembers(projectId) {
    try {
      const r = await fetchMembers(projectId);
      setMembers((m) => ({ ...m, [projectId]: r }));
    } catch (e) {
      setError(e.message || "load_members_failed");
    }
  }

  async function fetchMembers(projectId) {
    const base = (await import("../../../utils/calcApiBase.js")).getCalcApiBase();
    const token = auth?.accessToken || "";
    const resp = await fetch(`${base}/api/traktime/projects/${projectId}/members`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await resp.json();
    return data.members || [];
  }

  async function createProject() {
    if (!draft.client_id || !draft.name.trim()) return;
    setBusy(true);
    try {
      await tkApi.createProject({
        ...draft,
        hourly_rate_usd: Number(draft.hourly_rate_usd) || 0,
        rounding_minutes: Number(draft.rounding_minutes),
      });
      setDraft({
        client_id: "",
        name: "",
        color_hex: "#0071e3",
        hourly_rate_usd: 0,
        rounding_minutes: 15,
      });
      await loadAll();
      onChange?.();
    } catch (e) {
      setError(e.message || "create_failed");
    } finally {
      setBusy(false);
    }
  }

  async function addMember(projectId, userId) {
    if (!userId) return;
    const role = memberDraft[projectId]?.role || "member";
    try {
      const base = (await import("../../../utils/calcApiBase.js")).getCalcApiBase();
      const token = auth?.accessToken || "";
      await fetch(`${base}/api/traktime/projects/${projectId}/members`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: userId, role }),
      });
      setMemberDraft((m) => ({ ...m, [projectId]: { role: "member" } }));
      await loadMembers(projectId);
    } catch (e) {
      setError(e.message || "add_member_failed");
    }
  }

  async function removeMember(projectId, userId) {
    try {
      const base = (await import("../../../utils/calcApiBase.js")).getCalcApiBase();
      const token =
        (typeof window !== "undefined" && window.localStorage?.getItem("bmc_access_jwt")) || "";
      await fetch(`${base}/api/traktime/projects/${projectId}/members/${userId}`, {
        method: "DELETE",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      await loadMembers(projectId);
    } catch (e) {
      setError(e.message || "remove_member_failed");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <div style={{ color: colors.danger }}>{error}</div> : null}

      {canEdit ? (
        <div style={{ ...card, display: "grid", gap: 8, gridTemplateColumns: "1.5fr 2fr 90px 90px 90px auto" }}>
          <select
            value={draft.client_id}
            onChange={(e) => setDraft({ ...draft, client_id: e.target.value })}
            style={input}
          >
            <option value="">Cliente…</option>
            {clients.map((c) => (
              <option key={c.client_id} value={c.client_id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Nombre del proyecto"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            style={input}
          />
          <input
            type="color"
            value={draft.color_hex}
            onChange={(e) => setDraft({ ...draft, color_hex: e.target.value })}
            style={{ ...input, padding: 2, height: 36 }}
          />
          <input
            placeholder="USD/h"
            value={draft.hourly_rate_usd}
            onChange={(e) => setDraft({ ...draft, hourly_rate_usd: e.target.value })}
            style={input}
          />
          <select
            value={draft.rounding_minutes}
            onChange={(e) => setDraft({ ...draft, rounding_minutes: e.target.value })}
            style={input}
            title="Redondeo (min)"
          >
            {ROUNDING_OPTS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
          <button disabled={busy} onClick={createProject} style={button("primary")}>
            + Proyecto
          </button>
        </div>
      ) : null}

      <div style={card}>
        {projects.length === 0 ? (
          <div style={{ color: colors.textMuted, textAlign: "center", padding: 16 }}>
            Sin proyectos aún.
          </div>
        ) : (
          projects.map((p) => (
            <div key={p.project_id} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 2fr 1.5fr 80px 80px auto",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 0",
                  cursor: canEdit ? "pointer" : "default",
                }}
                onClick={() => {
                  if (!canEdit) return;
                  if (expanded === p.project_id) {
                    setExpanded(null);
                  } else {
                    setExpanded(p.project_id);
                    loadMembers(p.project_id);
                  }
                }}
              >
                <span style={dot(p.color_hex)} />
                <div style={{ fontWeight: 600 }}>{p.name}</div>
                <div style={{ color: colors.textMuted, fontSize: 13 }}>{p.client_name}</div>
                <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 13 }}>
                  ${Number(p.hourly_rate_usd).toFixed(2)}/h
                </div>
                <div style={{ fontSize: 13, color: colors.textMuted }}>
                  {p.rounding_minutes}m
                </div>
                {canEdit ? (
                  <div style={{ fontSize: 13, color: colors.textMuted }}>
                    {expanded === p.project_id ? "▲" : "▼"}
                  </div>
                ) : (
                  <div />
                )}
              </div>

              {canEdit && expanded === p.project_id ? (
                <div style={{ padding: "8px 12px 16px", background: colors.bgSubtle }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Miembros</div>
                  {(members[p.project_id] || []).length === 0 ? (
                    <div style={{ color: colors.textMuted, fontSize: 13, marginBottom: 8 }}>
                      Aún sin miembros (los administradores pueden trabajar igualmente).
                    </div>
                  ) : (
                    (members[p.project_id] || []).map((m) => (
                      <div
                        key={m.user_id}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          padding: "4px 0",
                          fontSize: 13,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {m.email || <span style={{ fontFamily: "monospace", fontSize: 11 }}>{m.user_id}</span>}
                          </div>
                          {m.name ? (
                            <div style={{ fontSize: 11, color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.name}
                            </div>
                          ) : null}
                        </div>
                        <span style={{ color: colors.textMuted }}>{m.role}</span>
                        <button
                          onClick={() => removeMember(p.project_id, m.user_id)}
                          style={{
                            ...button("ghost"),
                            padding: "4px 10px",
                            fontSize: 12,
                          }}
                        >
                          quitar
                        </button>
                      </div>
                    ))
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <UserCombobox
                        placeholder="Buscar usuario por email o nombre…"
                        onSelect={(u) => addMember(p.project_id, u.user_id)}
                      />
                    </div>
                    <select
                      value={memberDraft[p.project_id]?.role || "member"}
                      onChange={(e) =>
                        setMemberDraft((m) => ({
                          ...m,
                          [p.project_id]: { ...(m[p.project_id] || {}), role: e.target.value },
                        }))
                      }
                      style={input}
                      title="Rol asignado al agregar"
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
