// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/tasks/TasksModule.jsx — Tareas (Tasks) module entry
// ───────────────────────────────────────────────────────────────────────────
// Lazy-loaded by identity.modules gating ("tareas").
// Renders sidebar (lists) + main area (tasks in selected list).
//
// Write actions (create/edit/delete task or list) are present in the UI but
// degraded — backend returns 503 until Google Tasks OAuth + sync are
// provisioned by the operator. Read surface works the moment a list has
// been synced from Google.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  useTaskLists,
  useTaskList,
  useTasks,
  useCreateTaskList,
  useDeleteTaskList,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "./hooks/useTasks.js";
import { useBmcAuth } from "../../../hooks/useBmcAuth.js";

// ─────────────────────────────────────────────────────────────────────────────
// Empty / error / unavailable states (reused across panels)
// ─────────────────────────────────────────────────────────────────────────────

function EmptyConnectCTA({ accessToken }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function startConnect() {
    if (!accessToken) {
      setErr("Iniciá sesión antes de conectar Google Tasks.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/auth/tasks/init", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        setErr(data?.message || data?.error || `init_failed (${res.status})`);
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setErr(e?.message || "network_error");
      setBusy(false);
    }
  }

  return (
    <div style={panel("center")}>
      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
        Conectá tu cuenta de Google Tasks
      </h3>
      <p style={muted}>
        Necesitamos autorizar el acceso a tus listas y tareas. Esto solo se
        hace una vez.
      </p>
      <button
        type="button"
        onClick={startConnect}
        disabled={busy}
        style={{ ...primaryBtn, opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer", border: "none" }}
      >
        {busy ? "Redirigiendo…" : "🔗 Conectar Google Tasks"}
      </button>
      {err ? (
        <p style={{ ...muted, color: "#b91c1c", marginTop: "0.75rem" }}>
          {err}
        </p>
      ) : null}
      <p style={{ ...muted, marginTop: "1.5rem", fontSize: "0.75rem" }}>
        Estado actual: configuración pendiente del operador (ver
        <code style={code}> docs/hub-tasks-module/PHASE-1-INFRASTRUCTURE.md</code>).
      </p>
    </div>
  );
}

function ErrorPanel({ error }) {
  if (error?.unavailable) {
    return (
      <div style={panel("left")}>
        <p style={{ margin: 0, color: "#b45309", fontWeight: 600 }}>
          ⚠️ Sync no configurado
        </p>
        <p style={muted}>{error.message}</p>
      </div>
    );
  }
  return (
    <div style={panel("left")}>
      <p style={{ margin: 0, color: "#b91c1c", fontWeight: 600 }}>
        Error: {error?.message || "Unknown"}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar — list of task lists
// ─────────────────────────────────────────────────────────────────────────────

function TaskListPicker({ selectedListId, onSelect }) {
  const { data, isLoading, error } = useTaskLists();
  const createList = useCreateTaskList();
  const deleteList = useDeleteTaskList();

  if (isLoading) {
    return <p style={muted}>Cargando listas…</p>;
  }
  if (error) return <ErrorPanel error={error} />;
  const lists = data?.lists || [];

  const onNewList = () => {
    const title = window.prompt("Nombre de la nueva lista:");
    if (!title || !title.trim()) return;
    createList.mutate({ title: title.trim() }, {
      onSuccess: (res) => onSelect(res?.list?.id),
      onError: (e) => window.alert(`No se pudo crear: ${e.message}`),
    });
  };

  const onDeleteList = (l) => {
    if (!window.confirm(`Borrar "${l.title}" y todas sus tareas? Se borrará también de Google Tasks.`)) return;
    deleteList.mutate(l.id, {
      onSuccess: () => { if (l.id === selectedListId) onSelect(null); },
      onError: (e) => window.alert(`No se pudo borrar: ${e.message}`),
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={onNewList}
        disabled={createList.isPending}
        style={{ ...primaryBtn, width: "100%", marginBottom: "0.75rem", padding: "0.5rem", fontSize: "0.875rem" }}
      >
        {createList.isPending ? "Creando…" : "+ Nueva lista"}
      </button>
      {lists.length === 0 ? (
        <p style={muted}>Aún no hay listas. Crea una con el botón arriba.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {lists.map((l) => {
            const isActive = l.id === selectedListId;
            return (
              <li key={l.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => onSelect(l.id)}
                  style={{
                    ...listItem,
                    background: isActive ? "#eff6ff" : "transparent",
                    color: isActive ? "#1d4ed8" : "#111827",
                    fontWeight: isActive ? 600 : 400,
                    flex: 1,
                  }}
                >
                  {l.title || "(sin nombre)"}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteList(l)}
                  title={`Borrar lista "${l.title}"`}
                  style={{ border: "none", background: "transparent", color: "#9ca3af", cursor: "pointer", padding: "0 6px", fontSize: 14 }}
                  aria-label={`Borrar ${l.title}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main area — tasks in selected list
// ─────────────────────────────────────────────────────────────────────────────

function TaskListDetail({ listId }) {
  const list = useTaskList(listId);
  const tasksQ = useTasks(listId);
  const createTask = useCreateTask(listId);
  const [newTitle, setNewTitle] = useState("");

  if (list.isLoading || tasksQ.isLoading) {
    return <p style={muted}>Cargando tareas…</p>;
  }
  if (list.error) return <ErrorPanel error={list.error} />;
  if (tasksQ.error) return <ErrorPanel error={tasksQ.error} />;

  const meta = list.data?.list;
  const tasks = tasksQ.data?.tasks || [];

  const onCreate = (e) => {
    e?.preventDefault?.();
    const title = newTitle.trim();
    if (!title) return;
    createTask.mutate(
      { title },
      {
        onSuccess: () => setNewTitle(""),
        onError: (err) => window.alert(`No se pudo crear la tarea: ${err.message}`),
      },
    );
  };

  return (
    <div>
      <header style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>
          {meta?.title || "Lista"}
        </h2>
        {meta?.description ? (
          <p style={muted}>{meta.description}</p>
        ) : null}
        <p style={{ ...muted, fontSize: "0.75rem" }}>
          {tasks.length} tarea{tasks.length === 1 ? "" : "s"}
          {meta?.synced_at
            ? ` · sync: ${new Date(meta.synced_at).toLocaleString()}`
            : " · sync: nunca"}
        </p>
      </header>

      <form
        onSubmit={onCreate}
        style={{ display: "flex", gap: 8, marginBottom: "1rem" }}
      >
        <input
          type="text"
          placeholder="Nueva tarea — Enter para crear"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          style={{
            flex: 1, padding: "0.5rem 0.75rem", fontSize: "0.9375rem",
            border: "1px solid #e5e7eb", borderRadius: 6,
          }}
        />
        <button
          type="submit"
          disabled={createTask.isPending || !newTitle.trim()}
          style={{ ...primaryBtn, padding: "0.5rem 1rem" }}
        >
          {createTask.isPending ? "Creando…" : "Agregar"}
        </button>
      </form>

      {tasks.length === 0 ? (
        <p style={muted}>No hay tareas en esta lista. Escribí arriba para crear la primera.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} listId={listId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({ task, listId }) {
  const updateTask = useUpdateTask(listId, task.id);
  const deleteTask = useDeleteTask(listId, task.id);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);

  const toggleStatus = () => {
    updateTask.mutate({
      status: task.status === "completed" ? "needsAction" : "completed",
    });
  };

  const saveTitle = () => {
    const title = draftTitle.trim();
    if (!title || title === task.title) { setEditing(false); return; }
    updateTask.mutate({ title }, { onSuccess: () => setEditing(false) });
  };

  const onDelete = () => {
    if (!window.confirm(`Borrar "${task.title}"? Se borrará también de Google Tasks.`)) return;
    deleteTask.mutate(undefined, {
      onError: (e) => window.alert(`No se pudo borrar: ${e.message}`),
    });
  };

  return (
    <li style={taskItem}>
      <button
        type="button"
        onClick={toggleStatus}
        disabled={updateTask.isPending}
        title={task.status === "completed" ? "Marcar como pendiente" : "Marcar como completada"}
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 18, padding: 0, marginRight: 8, lineHeight: 1,
        }}
        aria-label={task.status === "completed" ? "Marcar como pendiente" : "Marcar como completada"}
      >
        {task.status === "completed" ? "☑" : "☐"}
      </button>
      {editing ? (
        <input
          type="text"
          value={draftTitle}
          autoFocus
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveTitle();
            if (e.key === "Escape") { setDraftTitle(task.title); setEditing(false); }
          }}
          style={{ flex: 1, padding: "0.25rem 0.5rem", border: "1px solid #d1d5db", borderRadius: 4 }}
        />
      ) : (
        <span
          onClick={() => { setDraftTitle(task.title); setEditing(true); }}
          style={{
            flex: 1, cursor: "pointer",
            textDecoration: task.status === "completed" ? "line-through" : "none",
            color: task.status === "completed" ? "#6b7280" : "#111827",
          }}
          title="Click para editar"
        >
          {task.title}
        </span>
      )}
      {task.due ? (
        <span style={{ ...muted, fontSize: "0.75rem", marginLeft: 8 }}>
          · vence {task.due.slice(0, 10)}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onDelete}
        disabled={deleteTask.isPending}
        style={{
          background: "transparent", border: "none", color: "#9ca3af",
          cursor: "pointer", fontSize: 14, marginLeft: 8, padding: "0 4px",
        }}
        title={`Borrar "${task.title}"`}
        aria-label={`Borrar ${task.title}`}
      >
        ×
      </button>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Module entry (no Suspense — TanStack Query handles loading internally)
// ─────────────────────────────────────────────────────────────────────────────

export default function TasksModule() {
  const [selectedListId, setSelectedListId] = useState(null);
  const { data, isLoading } = useTaskLists();
  const { accessToken } = useBmcAuth();
  const hasLists = !isLoading && (data?.lists?.length || 0) > 0;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Tareas</h1>
      <p style={muted}>
        Espejo bidireccional de tus listas y tareas de Google Tasks.
      </p>

      {!isLoading && !hasLists ? (
        <EmptyConnectCTA accessToken={accessToken} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "250px 1fr",
            gap: "1.5rem",
            marginTop: "1.5rem",
          }}
        >
          <aside style={{ borderRight: "1px solid #e5e7eb", paddingRight: "1rem" }}>
            <h2 style={{ fontSize: "0.875rem", textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.05em" }}>
              Mis listas
            </h2>
            <TaskListPicker
              selectedListId={selectedListId}
              onSelect={setSelectedListId}
            />
          </aside>

          <main>
            {selectedListId ? (
              <TaskListDetail listId={selectedListId} />
            ) : (
              <p style={muted}>Seleccioná una lista para ver sus tareas.</p>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline styles (kept here to avoid CSS file proliferation for an MVP)
// ─────────────────────────────────────────────────────────────────────────────

const muted = { color: "#6b7280", fontSize: "0.875rem", margin: "0.5rem 0" };
const code = {
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  fontSize: "0.75rem",
  background: "#f3f4f6",
  padding: "0.125rem 0.25rem",
  borderRadius: 3,
};
const listItem = {
  width: "100%",
  textAlign: "left",
  border: "none",
  background: "transparent",
  padding: "0.5rem 0.75rem",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "0.9375rem",
};
const taskItem = {
  display: "flex",
  alignItems: "center",
  padding: "0.5rem 0.25rem",
  borderBottom: "1px solid #f3f4f6",
  fontSize: "0.9375rem",
};
const primaryBtn = {
  display: "inline-block",
  marginTop: "1rem",
  padding: "0.5rem 1rem",
  background: "#2563eb",
  color: "white",
  textDecoration: "none",
  borderRadius: 6,
  fontWeight: 500,
};
function panel(align) {
  return {
    marginTop: "1.5rem",
    padding: "1.5rem",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#fafafa",
    textAlign: align,
  };
}
