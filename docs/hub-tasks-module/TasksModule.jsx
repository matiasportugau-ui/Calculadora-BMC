// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/tasks/TasksModule.jsx — Tasks (Tareas) Hub Module
// ───────────────────────────────────────────────────────────────────────────
// Lazy-loadable module entry point for the Tasks feature.
// Mounted at /hub/tareas in the router.
// ═══════════════════════════════════════════════════════════════════════════

import React, { Suspense, useState } from "react";

/**
 * TasksModule component — entry point for the Tasks hub module.
 *
 * TODO: Implement:
 * - OAuth flow integration (useTasksOAuth hook)
 * - Task list display + CRUD
 * - Task item display + CRUD
 * - Sync status indicator
 * - Conflict resolution UI
 */
export default function TasksModule() {
  const [authToken, setAuthToken] = useState(null);
  const [activeListId, setActiveListId] = useState(null);

  return (
    <div
      style={{
        padding: "24px",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <h1>Tareas</h1>

      {!authToken ? (
        <div style={{ padding: "16px", border: "1px solid #ccc", borderRadius: "8px" }}>
          <p>Conectar con Google Tasks para ver tus tareas.</p>
          <button
            onClick={() => {
              // TODO: Trigger /auth/tasks/init flow
              console.log("TODO: Start OAuth flow");
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#4285F4",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Conectar con Google Tasks
          </button>
        </div>
      ) : (
        <Suspense fallback={<div>Cargando tareas...</div>}>
          <div style={{ marginTop: "24px" }}>
            <p>Tareas conectadas. TODO: Render task lists + items.</p>
            {/* TODO: Render task lists, items, sync status */}
          </div>
        </Suspense>
      )}
    </div>
  );
}
