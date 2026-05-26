// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/tasks/TasksModule.jsx — Tareas (Tasks) module entry
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  useTaskLists,
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "./hooks/useTasks.js";
import { useSyncStatus, useSyncConflicts, useResolveConflict } from "./hooks/useTasksSync.js";

// ─── Empty / error states ────────────────────────────────────────────────────

function EmptyConnectCTA() {
  return (
    <div style={panel("center")}>
      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
        Conectá tu cuenta de Google Tasks
      </h3>
      <p style={muted}>
        Necesitamos autorizar el acceso a tus listas y tareas.
      </p>
      <a href="/auth/tasks/init" style={primaryBtn}>Conectar Google Tasks</a>
    </div>
  );
}

function ErrorPanel({ error }) {
  return (
    <div style={panel("left")}>
      <p style={{ margin: 0, color: "#b91c1c", fontWeight: 600 }}>
        Error: {error?.message || "Unknown"}
      </p>
    </div>
  );
}

// ─── Sync status bar ─────────────────────────────────────────────────────────

function SyncStatusBar() {
  const { data } = useSyncStatus();
  if (!data) return null;
  const ago = data.lastSync
    ? timeAgo(new Date(data.lastSync))
    : "nunca";
  return (
    <div style={{ fontSize: "0.75rem", color: "#6b7280", display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <span>{data.connected ? "🟢 Conectado" : "🔴 Desconectado"}</span>
      <span>Última sync: {ago}</span>
      {data.conflicts > 0 && (
        <span style={{ color: "#b45309", fontWeight: 600 }}>
          ⚠️ {data.conflicts} conflicto{data.conflicts > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

// ─── Conflict banner ─────────────────────────────────────────────────────────

function ConflictBanner() {
  const { data } = useSyncConflicts();
  const resolve = useResolveConflict();
  if (!data?.conflicts?.length) return null;
  return (
    <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6 }}>
      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.875rem" }}>
        {data.conflicts.length} conflicto{data.conflicts.length > 1 ? "s" : ""} por revisar
      </p>
      {data.conflicts.map((c) => (
        <div key={c.id} style={{ marginTop: "0.5rem", fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>{c.conflict_type === "soft_delete_mismatch" ? "Borrado local vs activo en Google" : "Edición concurrente"}</span>
          <button type="button" onClick={() => resolve.mutate({ conflictId: c.id, resolution: "take_google" })} style={smallBtn}>
            Usar Google
          </button>
          <button type="button" onClick={() => resolve.mutate({ conflictId: c.id, resolution: "take_hub" })} style={smallBtn}>
            Usar HUB
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function TaskListPicker({ selectedListId, onSelect }) {
  const { data, isLoading, error } = useTaskLists();
  if (isLoading) return <p style={muted}>Cargando listas…</p>;
  if (error) return <ErrorPanel error={error} />;
  const lists = data?.lists || [];
  if (lists.length === 0) return <p style={muted}>No hay listas aún.</p>;
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {lists.map((l) => (
        <li key={l.id}>
          <button
            type="button"
            onClick={() => onSelect(l.id)}
            style={{
              ...listItem,
              background: l.id === selectedListId ? "#eff6ff" : "transparent",
              color: l.id === selectedListId ? "#1d4ed8" : "#111827",
              fontWeight: l.id === selectedListId ? 600 : 400,
            }}
          >
            {l.title || "(sin nombre)"}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── Task item with toggle + delete ──────────────────────────────────────────

function TaskRow({ task, listId }) {
  const update = useUpdateTask(listId, task.id);
  const remove = useDeleteTask(listId, task.id);
  const toggleStatus = task.status === "completed" ? "needsAction" : "completed";
  return (
    <li style={taskItem}>
      <button
        type="button"
        onClick={() => update.mutate({ status: toggleStatus })}
        style={{ border: "none", background: "none", cursor: "pointer", fontSize: "1rem", padding: 0, marginRight: "0.5rem" }}
        disabled={update.isPending}
      >
        {task.status === "completed" ? "☑" : "☐"}
      </button>
      <span style={{
        flex: 1,
        textDecoration: task.status === "completed" ? "line-through" : "none",
        color: task.status === "completed" ? "#6b7280" : "#111827",
      }}>
        {task.title}
      </span>
      {task.due && <span style={{ ...muted, fontSize: "0.75rem", marginRight: "0.5rem" }}>vence {task.due}</span>}
      <button
        type="button"
        onClick={() => remove.mutate()}
        style={{ border: "none", background: "none", cursor: "pointer", color: "#dc2626", fontSize: "0.8125rem" }}
        disabled={remove.isPending}
      >
        ✕
      </button>
    </li>
  );
}

// ─── Create task form ────────────────────────────────────────────────────────

function CreateTaskForm({ listId }) {
  const [title, setTitle] = useState("");
  const create = useCreateTask(listId);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate({ title: title.trim() }, { onSuccess: () => setTitle("") });
  };
  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nueva tarea…"
        style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.875rem" }}
      />
      <button
        type="submit"
        disabled={create.isPending || !title.trim()}
        style={{ ...primaryBtn, margin: 0, opacity: create.isPending ? 0.6 : 1 }}
      >
        {create.isPending ? "…" : "+ Crear"}
      </button>
    </form>
  );
}

// ─── Main area ───────────────────────────────────────────────────────────────

function TaskListDetail({ listId }) {
  const tasksQ = useTasks(listId);
  if (tasksQ.isLoading) return <p style={muted}>Cargando tareas…</p>;
  if (tasksQ.error) return <ErrorPanel error={tasksQ.error} />;
  const tasks = tasksQ.data?.tasks || [];
  return (
    <div>
      <CreateTaskForm listId={listId} />
      {tasks.length === 0 ? (
        <p style={muted}>No hay tareas en esta lista.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {tasks.map((t) => <TaskRow key={t.id} task={t} listId={listId} />)}
        </ul>
      )}
    </div>
  );
}

// ─── Module entry ────────────────────────────────────────────────────────────

export default function TasksModule() {
  const [selectedListId, setSelectedListId] = useState(null);
  const { data, isLoading } = useTaskLists();
  const hasLists = !isLoading && (data?.lists?.length || 0) > 0;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h1 style={{ margin: 0 }}>Tareas</h1>
        <SyncStatusBar />
      </div>
      <p style={muted}>Espejo bidireccional de tus listas y tareas de Google Tasks.</p>

      <ConflictBanner />

      {!isLoading && !hasLists ? (
        <EmptyConnectCTA />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: "1.5rem", marginTop: "1rem" }}>
          <aside style={{ borderRight: "1px solid #e5e7eb", paddingRight: "1rem" }}>
            <h2 style={{ fontSize: "0.875rem", textTransform: "uppercase", color: "#6b7280", letterSpacing: "0.05em" }}>
              Mis listas
            </h2>
            <TaskListPicker selectedListId={selectedListId} onSelect={setSelectedListId} />
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "hace segundos";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
  return date.toLocaleDateString();
}

// ─── Inline styles ───────────────────────────────────────────────────────────

const muted = { color: "#6b7280", fontSize: "0.875rem", margin: "0.5rem 0" };
const listItem = {
  width: "100%", textAlign: "left", border: "none", background: "transparent",
  padding: "0.5rem 0.75rem", borderRadius: 4, cursor: "pointer", fontSize: "0.9375rem",
};
const taskItem = {
  display: "flex", alignItems: "center", padding: "0.5rem 0.25rem",
  borderBottom: "1px solid #f3f4f6", fontSize: "0.9375rem",
};
const primaryBtn = {
  display: "inline-block", marginTop: "1rem", padding: "0.5rem 1rem",
  background: "#2563eb", color: "white", textDecoration: "none",
  borderRadius: 6, fontWeight: 500, border: "none", cursor: "pointer",
};
const smallBtn = {
  padding: "0.25rem 0.5rem", border: "1px solid #d1d5db", borderRadius: 4,
  background: "white", cursor: "pointer", fontSize: "0.75rem",
};
function panel(align) {
  return { marginTop: "1.5rem", padding: "1.5rem", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fafafa", textAlign: align };
}
