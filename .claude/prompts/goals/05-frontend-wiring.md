# Goal 05 — Wire Frontend Components to Live API

## Objective
Connect the existing frontend stubs (`TasksModule.jsx`, `useTasks.js`, `useTasksSync.js`) to the real backend endpoints (Goals 02-04). Add `/hub/tareas` route to `src/App.jsx`. Deliver a usable task management UI.

## Prerequisites
- Goals 02-04 complete (OAuth, CRUD, Sync endpoints live).
- `@tanstack/react-query` already installed (Phase 0).

## Files to modify
- `src/components/hub/tasks/hooks/useTasks.js` — add mutations for POST/PATCH/DELETE
- `src/components/hub/tasks/hooks/useTasksSync.js` — implement sync status + conflict query
- `src/components/hub/tasks/TasksModule.jsx` — add CRUD UI, sync status bar, conflict list
- `src/App.jsx` — add `/hub/tareas` route (lazy-loaded)

## Implementation spec

### useTasks.js — TanStack Query hooks
```js
// Already has: useTaskLists(), useTaskList(listId) — READ queries
// Add:
useCreateTask(listId)    // useMutation → POST /api/tasks/lists/:id/tasks
useUpdateTask(listId)    // useMutation → PATCH /api/tasks/lists/:id/tasks/:taskId
useDeleteTask(listId)    // useMutation → DELETE /api/tasks/lists/:id/tasks/:taskId
useCreateTaskList()      // useMutation → POST /api/tasks/lists
useDeleteTaskList()      // useMutation → DELETE /api/tasks/lists/:id
```
Each mutation: optimistic update via `queryClient.setQueryData`, rollback `onError`, invalidate `onSettled`.

### useTasksSync.js — Sync hooks
```js
useSyncStatus()          // GET /api/tasks/sync-log?limit=1 → { lastSync, status }
useManualSync()          // POST trigger (if endpoint exists) or just refetch queries
useConflicts()           // GET sync conflicts → list of unresolved conflicts
useResolveConflict()     // PATCH resolve conflict (keep-local or keep-remote)
```

### TasksModule.jsx — UI
- **Top bar:** Google account connection status + "Conectar Google Tasks" button → `/auth/tasks/init`
- **Sidebar:** Task list picker (already exists from Phase 0)
- **Main area:** Task list with checkboxes (toggle `completed`), inline title edit, delete button
- **Bottom bar:** Sync status ("Última sync: hace 2 min") + manual sync button
- **Conflict banner:** If `conflicts.length > 0`, show yellow banner "N conflictos por revisar" with expandable list

### App.jsx — Route
```jsx
const TasksRoute = lazy(() => import('./components/hub/tasks/TasksModule.jsx'));
// Add inside hub routes:
<Route path="/hub/tareas" element={<Shell><Suspense fallback={suspenseFallback}><TasksRoute /></Suspense></Shell>} />
```

## Verification
```bash
npm run lint -- src/components/hub/tasks/ src/App.jsx
npm run dev  # verify /hub/tareas renders, CRUD works, sync status shows
npm run gate:local
```

## Exit
```bash
git add src/components/hub/tasks/ src/App.jsx
git commit -m "feat(tasks-frontend): wire components and hooks to API"
git push -u origin HEAD
```
