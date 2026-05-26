# Goal 03 — Implement Task CRUD Write Endpoints

## Objective
Replace 503 stubs in `server/routes/tasks.js` with real WRITE operations that create/update/delete tasks both locally (Supabase `tasks.*`) and remotely (Google Tasks API push).

## Prerequisites
- Goal 02 complete (OAuth PKCE working, tokens in `tasks.oauth_tokens`).
- `server/lib/tasksTokenCrypto.js` exists (from Goal 02).

## Files to modify
- `server/routes/tasks.js` — replace 503 stubs for POST/PATCH/DELETE with real logic

## Files to create
- `server/lib/tasksClient.js` — shared Google Tasks API client helper:
  - `getTasksClient(pool, userId, encryptionKey)` → authenticated `@googleapis/tasks` client
  - `refreshTokenIfNeeded(pool, userId, tokens, config)` → refresh expired access_token
  - `mapGoogleTaskToDb(googleTask)` → transform API response to DB row shape
  - `mapDbTaskToGoogle(dbTask)` → transform DB row to API request shape

## Implementation spec

### POST /api/tasks/lists/:id/tasks
1. Validate body: `{ title }` required, optional `{ notes, due, status }`.
2. Get Google Tasks client via `getTasksClient()`.
3. Call Google Tasks API: `tasks.tasks.insert({ tasklist: list.google_id, requestBody: { title, notes, due, status } })`.
4. Map response to DB schema.
5. INSERT into `tasks.tasks` with `google_id` from API response.
6. Return `{ ok: true, task: newTask }`.

### PATCH /api/tasks/lists/:id/tasks/:taskId
1. Validate body: at least one of `{ title, notes, due, status }`.
2. Lookup task: `SELECT google_id FROM tasks.tasks WHERE id = $1 AND user_id = $2`.
3. Get Google Tasks client.
4. Call Google Tasks API: `tasks.tasks.patch({ tasklist: list.google_id, task: task.google_id, requestBody })`.
5. UPDATE local DB row with response data.
6. Return `{ ok: true, task: updatedTask }`.

### DELETE /api/tasks/lists/:id/tasks/:taskId
1. Lookup task google_id.
2. Call Google Tasks API: `tasks.tasks.delete({ tasklist, task })`.
3. Soft-delete locally: `UPDATE tasks.tasks SET is_deleted = true, updated_at = now() WHERE id = $1`.
4. Return `{ ok: true }`.

### POST /api/tasks/lists (create list)
1. Validate body: `{ title }` required.
2. Google API: `tasks.tasklists.insert({ requestBody: { title } })`.
3. INSERT into `tasks.task_lists`.
4. Return `{ ok: true, list }`.

### DELETE /api/tasks/lists/:id (delete list)
1. Google API: `tasks.tasklists.delete({ tasklist: google_id })`.
2. DELETE cascade from `tasks.task_lists` (FK cascade handles tasks).
3. Return `{ ok: true }`.

## Error handling
- Google 401 → attempt token refresh → retry once → if still 401, return 401 `token_expired`.
- Google 429 → return 503 `rate_limited` (do NOT retry in request path).
- Google 5xx → return 503 `upstream_error`.
- DB error → return 500 `internal_error`.

## Verification
```bash
npm run lint -- server/routes/tasks.js server/lib/tasksClient.js
npm run gate:local
```

## Exit
```bash
git add server/routes/tasks.js server/lib/tasksClient.js
git commit -m "feat(tasks-crud): implement task list and task CRUD endpoints"
git push -u origin HEAD
```
