# 03 — Frontend: Component Architecture & Theme Design

**Date:** 2026-05-18  
**Status:** Component spec + theme tokens; implementation ready for Phase 1  
**Scope:** React 18 component tree, TanStack Query state management, theme extension, offline IndexedDB queue, demo artifact.

---

## Executive Summary

The Tareas frontend is a **lazy-loadable React 18 module** mounted at `/hub/tasks` (alongside `/hub/wa`, `/hub/ml`, `/hub/canales`). It uses:

- **TanStack Query (v5)** for server state + automatic cache invalidation
- **Theme extension** of BMC palette (Navy #0F2B46 + Amber #D4872E base)
- **IndexedDB offline queue** for mutations during network downtime
- **Optimistic UI updates** with rollback on error
- **Soft-delete + sync_conflicts UI** for human resolution

**Verdict:** Frontend is ready for Phase 1 implementation immediately. No new dependencies beyond @tanstack/react-query (already needed for server state).

---

## Component Tree Architecture

```
src/components/hub/tasks/
├── TasksModule.jsx               [entry point, lazy-loaded at /hub/tasks]
│   ├── Suspense boundary
│   ├── ErrorBoundary
│   └── <TasksHub />               [root layout container]
│
├── views/
│   ├── TasksHub.jsx              [main layout: list picker + task list + sync status]
│   ├── TaskListPicker.jsx         [left sidebar: list selection, create new]
│   ├── TaskListDetail.jsx         [center: task list with CRUD, drag-drop reorder]
│   ├── TaskEditor.jsx             [modal or sidebar: create/edit task form]
│   ├── ConflictResolver.jsx       [modal: show Google vs HUB state, allow picker]
│   └── SyncStatus.jsx             [top-right badge: last sync, pending mutations, error state]
│
├── hooks/
│   ├── useTasks.js               [TanStack Query hook: list CRUD, task CRUD]
│   ├── useTasksSync.js           [sync status + manual trigger + conflict subscription]
│   ├── useTasksOfflineQueue.js   [IndexedDB mutation queue, sync on network return]
│   └── useTasksTheme.js          [theme tokens: colors, typography, spacing]
│
├── components/
│   ├── TaskListItem.jsx          [single task row: title, due, status, actions]
│   ├── TaskListHeader.jsx        [list title, member count, actions dropdown]
│   ├── TaskForm.jsx              [reusable form: title, notes, due date, parent selector]
│   ├── TaskStatusBadge.jsx       [status pill: needs action, completed, pending]
│   ├── ConflictBanner.jsx        [inline warning: "Conflict detected; resolve now"]
│   └── SkeletonTask.jsx          [loading placeholder]
│
└── __tests__/
    ├── TasksModule.test.jsx      [module entry point; lazy load, auth guard]
    ├── useTasks.test.jsx         [hook contract: GET/POST/PATCH/DELETE]
    ├── useTasksOfflineQueue.test.jsx [offline persistence + online flush]
    └── integration/
        └── conflict-resolution.test.jsx [user flows: detect, picker, resolve]
```

---

## Theme Extension: Tareas Palette

### Base Palette (Inherited from BMC)

```javascript
// colors.tareas.js
export const tasksTheme = {
  // Brand palette (Navy + Amber foundation)
  primary: "#0F2B46",     // Navy (inherited from BMC_NAVY)
  accent: "#D4872E",      // Amber (inherited from BMC_AMBER)
  
  // Tasks-specific semantic colors
  status: {
    needsAction: "#EF4444",    // Red: task waiting for user
    completed: "#10B981",      // Green: done
    inProgress: "#F59E0B",     // Amber: in progress
    delegated: "#8B5CF6",      // Purple: assigned to other user
  },
  
  conflict: {
    background: "#FEF3C7",     // Light amber
    border: "#F59E0B",         // Amber
    text: "#92400E",           // Dark amber
  },
  
  sync: {
    pending: "#93C5FD",        // Light blue: waiting to sync
    inProgress: "#FBBF24",     // Light amber: syncing now
    error: "#FCA5A5",          // Light red: sync failed
    success: "#BBF7D0",        // Light green: synced
  },
  
  ui: {
    background: "#FFFFFF",
    surface: "#F9FAFB",        // Light gray
    border: "#E5E7EB",         // Medium gray
    textPrimary: "#1F2937",    // Dark gray
    textSecondary: "#6B7280",  // Medium gray
    textMuted: "#9CA3AF",      // Light gray
  },
  
  // Interaction states
  hover: "rgba(15, 43, 70, 0.08)",  // Navy at 8% opacity
  active: "rgba(15, 43, 70, 0.16)", // Navy at 16% opacity
  disabled: "#D1D5DB",               // Lighter gray
};
```

### Typography & Spacing

```javascript
// typography.tareas.js
export const tasksTypography = {
  // Heading hierarchy
  h1: { size: "24px", weight: 700, lineHeight: 1.2, letterSpacing: "-0.5px" },
  h2: { size: "20px", weight: 700, lineHeight: 1.3, letterSpacing: "-0.25px" },
  h3: { size: "18px", weight: 600, lineHeight: 1.4, letterSpacing: "0px" },
  
  // Body text
  body: { size: "14px", weight: 400, lineHeight: 1.5, letterSpacing: "0px" },
  bodySm: { size: "12px", weight: 400, lineHeight: 1.4, letterSpacing: "0px" },
  
  // Interactive
  button: { size: "14px", weight: 600, lineHeight: 1.4, letterSpacing: "0px" },
  label: { size: "12px", weight: 600, lineHeight: 1.4, letterSpacing: "0.5px" },
};

export const tasksSpacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "48px",
};
```

### Dark Mode Support (Optional Phase 2)

```javascript
export const tasksThemeDark = {
  ui: {
    background: "#111827",     // Very dark gray
    surface: "#1F2937",        // Dark gray
    border: "#374151",         // Medium dark gray
    textPrimary: "#F3F4F6",    // Very light gray
    textSecondary: "#D1D5DB",  // Light gray
    textMuted: "#9CA3AF",      // Medium gray
  },
  // ... rest of palette with dark mode adjustments
};
```

---

## State Management: TanStack Query Integration

### Hook: `useTasks()`

```typescript
// hooks/useTasks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useTasks(userId: string) {
  const qc = useQueryClient();
  
  // Queries
  const listTaskLists = useQuery({
    queryKey: ["tasks", userId, "lists"],
    queryFn: () => GET("/api/tasks/lists"),
    staleTime: 60_000,       // 60s until stale
    gcTime: 5 * 60_000,      // 5min in cache after unused
    enabled: !!userId,
  });
  
  const getTaskList = (listId: string) => useQuery({
    queryKey: ["tasks", userId, "lists", listId],
    queryFn: () => GET(`/api/tasks/lists/${listId}`),
    staleTime: 60_000,
    enabled: !!listId,
  });
  
  const listTasks = (listId: string, pageToken?: string) => useQuery({
    queryKey: ["tasks", userId, "lists", listId, "tasks", pageToken],
    queryFn: () => GET(`/api/tasks/lists/${listId}/tasks?pageToken=${pageToken || ""}`),
    staleTime: 60_000,
    enabled: !!listId,
  });
  
  // Mutations
  const createTaskList = useMutation({
    mutationFn: (data: { title: string; description?: string }) =>
      POST("/api/tasks/lists", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", userId, "lists"] });
    },
    onError: (err) => {
      // Rollback UI, show error banner
      console.error("Create list failed:", err);
    },
  });
  
  const createTask = useMutation({
    mutationFn: (data: { listId: string; title: string; notes?: string; due?: string; parent?: string }) =>
      POST(`/api/tasks/lists/${data.listId}/tasks`, data),
    onMutate: async (newTask) => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ["tasks", userId, "lists", newTask.listId, "tasks"] });
      const old = qc.getQueryData(["tasks", userId, "lists", newTask.listId, "tasks"]);
      qc.setQueryData(["tasks", userId, "lists", newTask.listId, "tasks"], (prev: any) => ({
        ...prev,
        tasks: [...prev.tasks, { ...newTask, id: `temp_${Date.now()}`, status: "needsAction" }],
      }));
      return { old };
    },
    onError: (err, newTask, ctx) => {
      // Rollback
      qc.setQueryData(["tasks", userId, "lists", newTask.listId, "tasks"], ctx?.old);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", userId, "lists"] });
    },
  });
  
  const updateTask = useMutation({
    mutationFn: (data: { listId: string; taskId: string; updates: object }) =>
      PATCH(`/api/tasks/lists/${data.listId}/tasks/${data.taskId}`, data.updates),
    onMutate: async (data) => {
      // Optimistic update (similar pattern to createTask)
    },
    onSuccess: (_, data) => {
      qc.invalidateQueries({ queryKey: ["tasks", userId, "lists", data.listId, "tasks"] });
    },
  });
  
  const deleteTask = useMutation({
    mutationFn: (data: { listId: string; taskId: string }) =>
      DELETE(`/api/tasks/lists/${data.listId}/tasks/${data.taskId}`),
    onMutate: async (data) => {
      // Soft-delete on UI immediately
    },
    onSuccess: (_, data) => {
      qc.invalidateQueries({ queryKey: ["tasks", userId, "lists", data.listId, "tasks"] });
    },
  });
  
  return {
    listTaskLists,
    getTaskList,
    listTasks,
    createTaskList,
    createTask,
    updateTask,
    deleteTask,
  };
}
```

### Hook: `useTasksSync()`

```typescript
// hooks/useTasksSync.ts
export function useTasksSync(userId: string) {
  const qc = useQueryClient();
  
  // Sync status query (updates every 5s)
  const syncStatus = useQuery({
    queryKey: ["tasks", userId, "sync-status"],
    queryFn: () => GET("/api/tasks/sync-status"),
    refetchInterval: 5_000,  // Poll every 5s
    staleTime: 2_000,
  });
  
  // Manual sync trigger
  const triggerManualSync = useMutation({
    mutationFn: () => POST("/api/tasks/sync/manual"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", userId, "sync-status"] });
      // Refetch lists after 2s (give Google a moment to propagate)
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["tasks", userId, "lists"] });
      }, 2000);
    },
  });
  
  // Conflict subscription (via polling)
  const conflicts = useQuery({
    queryKey: ["tasks", userId, "conflicts"],
    queryFn: () => GET("/api/tasks/conflicts"),
    refetchInterval: 10_000,  // Check every 10s
    staleTime: 5_000,
  });
  
  return {
    syncStatus,
    triggerManualSync,
    conflicts,
  };
}
```

---

## Offline Support: IndexedDB Queue

### Hook: `useTasksOfflineQueue()`

```typescript
// hooks/useTasksOfflineQueue.ts
export function useTasksOfflineQueue() {
  const [queue, setQueue] = useState<OfflineTask[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Open IndexedDB on mount
  useEffect(() => {
    const db = openIndexedDB("tareas");
    
    // Load pending mutations from store
    const tx = db.transaction("pending_mutations", "readonly");
    const store = tx.objectStore("pending_mutations");
    const getAll = store.getAll();
    getAll.onsuccess = () => setQueue(getAll.result);
  }, []);
  
  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  
  // Add mutation to queue (called before POST/PATCH/DELETE)
  const enqueue = useCallback((mutation: OfflineTask) => {
    const db = openIndexedDB("tareas");
    const tx = db.transaction("pending_mutations", "readwrite");
    const store = tx.objectStore("pending_mutations");
    store.add({ ...mutation, queuedAt: Date.now() });
    setQueue((prev) => [...prev, mutation]);
  }, []);
  
  // Flush queue when online
  const flushQueue = useCallback(async () => {
    if (!isOnline || queue.length === 0) return;
    
    const successful: string[] = [];
    for (const task of queue) {
      try {
        // Execute the queued mutation
        if (task.action === "create") {
          await POST(`/api/tasks/lists/${task.listId}/tasks`, task.data);
        } else if (task.action === "update") {
          await PATCH(`/api/tasks/lists/${task.listId}/tasks/${task.taskId}`, task.data);
        } else if (task.action === "delete") {
          await DELETE(`/api/tasks/lists/${task.listId}/tasks/${task.taskId}`);
        }
        successful.push(task.id);
      } catch (err) {
        console.error("Flush failed for", task.id, err);
        // Leave in queue; retry next online window
      }
    }
    
    // Remove successful mutations from queue
    const db = openIndexedDB("tareas");
    const tx = db.transaction("pending_mutations", "readwrite");
    const store = tx.objectStore("pending_mutations");
    successful.forEach((id) => store.delete(id));
    
    setQueue((prev) => prev.filter((t) => !successful.includes(t.id)));
  }, [isOnline, queue]);
  
  // Auto-flush when online
  useEffect(() => {
    if (isOnline) flushQueue();
  }, [isOnline, flushQueue]);
  
  return {
    queue,
    isOnline,
    enqueue,
    flushQueue,
    pendingCount: queue.length,
  };
}
```

### IndexedDB Schema

```sql
-- Conceptual schema (browser-side)
-- Database: "tareas"

ObjectStore: "pending_mutations"
  keyPath: "id" (UUID)
  indexes:
    - "queuedAt" (for sorting)
    - "listId" (for queries by list)
    - "action" (for filtering creates vs updates)
  
  Record structure:
  {
    id: UUID,
    action: "create" | "update" | "delete",
    listId: string,
    taskId?: string,
    data: object,
    queuedAt: timestamp,
    retries: number,
  }

ObjectStore: "sync_metadata"
  keyPath: "userId" (string)
  Record structure:
  {
    userId: string,
    lastSyncAt: timestamp,
    nextPageToken?: string,
    lastError?: string,
  }
```

---

## Component Examples

### TaskListItem.jsx

```jsx
import { useState } from "react";
import { tasksTheme } from "../hooks/useTasksTheme";

export function TaskListItem({ task, onEdit, onDelete, onStatusChange }) {
  const [isHovering, setIsHovering] = useState(false);
  
  const statusColor = {
    needsAction: tasksTheme.status.needsAction,
    completed: tasksTheme.status.completed,
    inProgress: tasksTheme.status.inProgress,
  }[task.status];
  
  return (
    <div
      className="task-item"
      style={{
        padding: "12px 16px",
        borderBottom: `1px solid ${tasksTheme.ui.border}`,
        backgroundColor: isHovering ? tasksTheme.ui.surface : "transparent",
        cursor: "pointer",
        transition: "background-color 0.2s",
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={task.status === "completed"}
          onChange={(e) => onStatusChange(e.target.checked ? "completed" : "needsAction")}
          style={{ cursor: "pointer" }}
        />
        
        {/* Title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: task.status === "completed" ? tasksTheme.ui.textMuted : tasksTheme.ui.textPrimary,
              textDecoration: task.status === "completed" ? "line-through" : "none",
            }}
          >
            {task.title}
          </div>
          {task.due && (
            <div style={{ fontSize: "12px", color: tasksTheme.ui.textMuted, marginTop: "4px" }}>
              Due: {new Date(task.due).toLocaleDateString()}
            </div>
          )}
        </div>
        
        {/* Status badge */}
        <div
          style={{
            display: "inline-block",
            padding: "4px 8px",
            backgroundColor: statusColor + "20",  // 20% opacity
            border: `1px solid ${statusColor}`,
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 600,
            color: statusColor,
          }}
        >
          {task.status}
        </div>
        
        {/* Actions */}
        {isHovering && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={onEdit} style={{ padding: "4px 8px", fontSize: "12px" }}>
              Edit
            </button>
            <button onClick={onDelete} style={{ padding: "4px 8px", fontSize: "12px", color: "red" }}>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### ConflictBanner.jsx

```jsx
export function ConflictBanner({ conflict, onResolve }) {
  const { taskId, conflictType, hubState, googleState } = conflict;
  
  return (
    <div
      style={{
        backgroundColor: tasksTheme.conflict.background,
        border: `1px solid ${tasksTheme.conflict.border}`,
        borderRadius: "6px",
        padding: "12px 16px",
        marginBottom: "16px",
      }}
    >
      <div style={{ color: tasksTheme.conflict.text, fontWeight: 600, marginBottom: "8px" }}>
        ⚠️ Conflict Detected
      </div>
      <div style={{ fontSize: "12px", color: tasksTheme.conflict.text, marginBottom: "12px" }}>
        Task was edited in both HUB and Google Tasks. Choose which version to keep.
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        <div>
          <strong>HUB Version:</strong>
          <pre style={{ fontSize: "11px", whiteSpace: "pre-wrap" }}>{JSON.stringify(hubState, null, 2)}</pre>
        </div>
        <div>
          <strong>Google Version:</strong>
          <pre style={{ fontSize: "11px", whiteSpace: "pre-wrap" }}>{JSON.stringify(googleState, null, 2)}</pre>
        </div>
      </div>
      
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => onResolve(taskId, "take_hub")}
          style={{ flex: 1, padding: "8px", backgroundColor: tasksTheme.primary, color: "white" }}
        >
          Keep HUB Version
        </button>
        <button
          onClick={() => onResolve(taskId, "take_google")}
          style={{ flex: 1, padding: "8px", backgroundColor: tasksTheme.accent, color: "white" }}
        >
          Keep Google Version
        </button>
      </div>
    </div>
  );
}
```

---

## Demo Artifact

### Path: `docs/hub-tasks-module/demo/index.html`

[DUDA ABIERTA: Interactive demo artifact deferred to Phase 1.5 if needed for stakeholder review. Current phase focuses on component scaffolding and state management. Demo may be:
1. Figma wireframe + prototype (quick, visual, non-interactive)
2. Storybook stories for individual components (dev-facing, verifiable)
3. Live React component in `demo/` folder (interactive, requires npm install)

Decision on demo medium: see 05-decisions.md ADR "Demo Artifact Format".]

---

## Accessibility & Keyboard Navigation

### WCAG 2.1 AA Compliance Checklist

- [ ] All interactive elements have `aria-label` or descriptive text
- [ ] Keyboard navigation: Tab → focus list → arrow keys to navigate tasks → Enter to edit → Escape to close
- [ ] Focus indicator visible (outline: 2px solid primary on `:focus`)
- [ ] Color contrast ratio ≥ 4.5:1 for text on background (test with WebAIM)
- [ ] Conflict banner announced with `aria-live="polite"` on status change
- [ ] Loading states announced with `aria-busy="true"` during mutations
- [ ] Error messages associated with form fields via `aria-describedby`

---

## Performance Optimizations

| Technique | Implementation | Metric Target |
|-----------|----------------|----|
| **Lazy Loading** | React.lazy(TasksModule), Suspense boundary | FCP < 2s |
| **Code Splitting** | Separate bundle for /hub/tasks (Vite dynamic import) | /hub/tasks chunk < 50KB (gzip) |
| **Query Caching** | TanStack Query staleTime: 60s, gcTime: 300s | FID < 100ms |
| **Virtual Scrolling** | Virtuoso for large task lists (1000+ items) | LCP < 3s (lazy list) |
| **Optimistic Updates** | Mutation onMutate callback, instant UI feedback | User perceives 0ms latency |
| **Image Optimization** | Avatars via WebP (future); task thumbnails lazy-loaded | CLS < 0.1 |

---

## Error Boundaries & Resilience

### ErrorBoundary Component

```jsx
export class TasksErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", color: "red" }}>
          <h2>Something went wrong in Tasks</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## Integration with Hub Architecture

### App.jsx Mount Point

[HECHO CONFIRMADO: Existing /hub routes pattern in App.jsx]

```jsx
// src/App.jsx
import { lazy, Suspense } from "react";

const TasksModule = lazy(() => import("./components/hub/tasks/TasksModule"));

export function App() {
  return (
    <Router>
      <Routes>
        {/* ... other routes ... */}
        <Route
          path="/hub/tasks/*"
          element={
            <Suspense fallback={<div>Loading Tasks...</div>}>
              <TasksModule />
            </Suspense>
          }
        />
      </Routes>
    </Router>
  );
}
```

---

## Open Items & TBDs (see 05-decisions.md)

1. **[DUDA ABIERTA] Demo Artifact Medium** — Figma prototype, Storybook, or live React? Decide in 05-decisions.md.
2. **[DUDA ABIERTA] Virtual Scrolling Threshold** — Trigger Virtuoso for lists > N tasks? Propose N=500, confirm with perf testing in Phase 2.
3. **[INFERENCIA] IndexedDB Quota** — Browser quota typically 50MB; tasks module estimates ~5MB max (test with actual data).
4. **[HECHO CONFIRMADO] Theme Integration** — BMC App.jsx already exports useTheme() hook; Tasks can import and extend.

---

## Cross-References

- [[01-architecture.md]] — Backend API routes (GET/POST/PATCH/DELETE /api/tasks/*) that these hooks call
- [[02-mcp-server.md]] — Optional MCP tools (list_tasks, create_task, etc.) that Claude can invoke
- [[04-roadmap.md]] — Phase 1–2 implementation timeline; frontend polish in Phase 2
- [[05-decisions.md]] — ADRs for state management framework, demo artifact medium, virtual scrolling threshold
- `docs/PRICING-ENGINE.md` — Price calculation patterns (similar UI patterns for task list editing)

---

## Conclusion

The Tareas frontend is **ready for Phase 1 implementation.** Component architecture is proven (matches /hub/wa, /hub/ml patterns). Theme extension is modular and non-breaking. State management via TanStack Query is standard for BMC. Offline queue via IndexedDB ensures mobile-first reliability.

**Next step:** Advance to 04-roadmap.md + 05-decisions.md to complete the dossier.
