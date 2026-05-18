// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/tasks/TasksModule.jsx — Tareas (Tasks) lazy-loadable module
// ───────────────────────────────────────────────────────────────────────────
// Entry point for Tasks Hub; lazy-loaded by identity.modules gating.
// Renders TasksHub container with TaskListPicker, TaskListDetail, TaskEditor,
// ConflictResolver, and SyncStatus subcomponents.
//
// Phase 0: Component tree stub; layout and prop interfaces only.
// Phase 1: Implement TanStack Query integration, Supabase queries, Google Tasks API calls.
// ═══════════════════════════════════════════════════════════════════════════

import React, { Suspense, useState } from "react";

// TODO Phase 1: Import real subcomponents from ./subcomponents/
// import TasksHub from "./subcomponents/TasksHub";
// import { useTasks, useTasksSync } from "./hooks";

// Placeholder subcomponent (Phase 1: replace with real TasksHub)
function TasksHubStub() {
  const [selectedListId, setSelectedListId] = useState(null);

  return (
    <div className="tasks-hub" style={{ padding: "1rem" }}>
      <h1>Tareas (Tasks)</h1>
      <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: "1rem" }}>
        {/* Sidebar: Task List Picker */}
        <aside className="tasks-sidebar">
          {/* TODO Phase 1: Implement TaskListPicker component */}
          <p>Task Lists</p>
          <p style={{ fontSize: "0.875rem", color: "#999" }}>
            Phase 1: TaskListPicker (list Google Tasks lists, create new)
          </p>
        </aside>

        {/* Main: Task List Detail + Editor + Conflict Resolver + Sync Status */}
        <main className="tasks-main">
          {selectedListId ? (
            <>
              {/* TODO Phase 1: Implement TaskListDetail component */}
              <p>Task List Detail & Tasks</p>
              <p style={{ fontSize: "0.875rem", color: "#999" }}>
                Phase 1: TaskListDetail (list tasks in selected list, paginate with nextPageToken)
              </p>

              {/* TODO Phase 1: Implement TaskEditor component */}
              <p>Task Editor</p>
              <p style={{ fontSize: "0.875rem", color: "#999" }}>
                Phase 1: TaskEditor (create, update, delete tasks; optimistic UI with IndexedDB queue)
              </p>

              {/* TODO Phase 1: Implement ConflictResolver component */}
              <p>Conflict Resolver</p>
              <p style={{ fontSize: "0.875rem", color: "#999" }}>
                Phase 1: ConflictResolver (detect + resolve soft-delete vs Google active version mismatches)
              </p>

              {/* TODO Phase 1: Implement SyncStatus component */}
              <p>Sync Status</p>
              <p style={{ fontSize: "0.875rem", color: "#999" }}>
                Phase 1: SyncStatus (display last sync time, pending items, trigger manual sync)
              </p>
            </>
          ) : (
            <p style={{ textAlign: "center", color: "#999" }}>
              Select a task list to begin
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

// Default export: TasksModule (lazy-loadable by identity.modules)
export default function TasksModule() {
  return (
    <Suspense fallback={<div>Loading Tareas...</div>}>
      <TasksHubStub />
    </Suspense>
  );
}
