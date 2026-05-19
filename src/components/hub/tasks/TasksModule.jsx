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
} from "./hooks/useTasks.js";

// ─────────────────────────────────────────────────────────────────────────────
// Empty / error / unavailable states (reused across panels)
// ─────────────────────────────────────────────────────────────────────────────

function EmptyConnectCTA() {
  return (
    <div style={panel("center")}>
      <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
        Conectá tu cuenta de Google Tasks
      </h3>
      <p style={muted}>
        Necesitamos autorizar el acceso a tus listas y tareas. Esto solo se
        hace una vez.
      </p>
      <a
        href="/auth/tasks/init"
        style={primaryBtn}
      >
        🔗 Conectar Google Tasks
      </a>
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

  if (isLoading) {
    return <p style={muted}>Cargando listas…</p>;
  }
  if (error) return <ErrorPanel error={error} />;
  const lists = data?.lists || [];

  if (lists.length === 0) {
    return (
      <p style={muted}>
        Aún no hay listas. Conectá Google Tasks para empezar.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {lists.map((l) => {
        const isActive = l.id === selectedListId;
        return (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => onSelect(l.id)}
              style={{
                ...listItem,
                background: isActive ? "#eff6ff" : "transparent",
                color: isActive ? "#1d4ed8" : "#111827",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {l.title || "(sin nombre)"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main area — tasks in selected list
// ─────────────────────────────────────────────────────────────────────────────

function TaskListDetail({ listId }) {
  const list = useTaskList(listId);
  const tasksQ = useTasks(listId);

  if (list.isLoading || tasksQ.isLoading) {
    return <p style={muted}>Cargando tareas…</p>;
  }
  if (list.error) return <ErrorPanel error={list.error} />;
  if (tasksQ.error) return <ErrorPanel error={tasksQ.error} />;

  const meta = list.data?.list;
  const tasks = tasksQ.data?.tasks || [];

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

      {tasks.length === 0 ? (
        <p style={muted}>No hay tareas en esta lista.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {tasks.map((t) => (
            <li key={t.id} style={taskItem}>
              <span style={{ marginRight: "0.5rem" }}>
                {t.status === "completed" ? "☑" : "☐"}
              </span>
              <span
                style={{
                  textDecoration:
                    t.status === "completed" ? "line-through" : "none",
                  color: t.status === "completed" ? "#6b7280" : "#111827",
                }}
              >
                {t.title}
              </span>
              {t.due ? (
                <span style={{ ...muted, fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                  · vence {t.due}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: "1.5rem", padding: "0.75rem", border: "1px dashed #d1d5db", borderRadius: 6 }}>
        <p style={{ ...muted, fontSize: "0.875rem", margin: 0 }}>
          ⏳ Crear, editar y borrar tareas estará disponible cuando el operador
          provisione el sync con Google Tasks.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Module entry (no Suspense — TanStack Query handles loading internally)
// ─────────────────────────────────────────────────────────────────────────────

export default function TasksModule() {
  const [selectedListId, setSelectedListId] = useState(null);
  const { data, isLoading } = useTaskLists();
  const hasLists = !isLoading && (data?.lists?.length || 0) > 0;

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0, marginBottom: "0.5rem" }}>Tareas</h1>
      <p style={muted}>
        Espejo bidireccional de tus listas y tareas de Google Tasks.
      </p>

      {!isLoading && !hasLists ? (
        <EmptyConnectCTA />
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
