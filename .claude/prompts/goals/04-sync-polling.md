# Goal 04 — Implement Google Tasks Sync Polling

## Objective
Complete Phase 1 of `server/routes/tasksSync.js`: pull changes from Google Tasks API for all users with active tokens, detect conflicts, log sync cycles.

## Prerequisites
- Goal 02 (OAuth tokens stored) and Goal 03 (tasksClient.js helper exists).

## Files to modify
- `server/routes/tasksSync.js` — replace stub with real polling logic

## Implementation spec

### POST /sync/google-tasks/pull (Cloud Scheduler target)
1. **HMAC verification** (already exists in stub — keep it).
2. Generate `cycleId` (UUID).
3. Query `tasks.oauth_tokens WHERE revoked_at IS NULL` → list of users.
4. For each user:
   a. Decrypt tokens via `tasksClient.getTasksClient()`.
   b. Get last `synced_at` from `tasks.task_lists WHERE user_id = $1 ORDER BY synced_at DESC LIMIT 1`.
   c. Fetch task lists: `tasks.tasklists.list()`.
   d. For each list, fetch tasks: `tasks.tasks.list({ tasklist, updatedMin: lastSyncedAt?.toISOString() })`.
   e. Handle pagination (`nextPageToken`).
   f. For each task from Google:
      - If no local match (`google_id`): INSERT new task.
      - If local match exists:
        - If local `is_deleted = true` but Google shows active → **CONFLICT** → INSERT into `tasks.sync_conflicts`.
        - If local `updated_at > synced_at` (local edit since last sync) and Google also changed → **CONFLICT**.
        - Otherwise: UPDATE local with Google data, set `synced_at = now()`.
   g. Update `task_lists.synced_at = now()`.
5. **Error handling per user:**
   - 401: attempt token refresh. If refresh fails → `UPDATE tasks.oauth_tokens SET revoked_at = now()`.
   - 429: log, skip this user, continue to next.
   - 5xx: log, skip, continue.
6. Log: `INSERT INTO tasks.sync_log (user_id, event_type, cycle_id, details) VALUES ($1, 'sync_completed', $2, $3::jsonb)`.
7. Return `{ ok: true, cycleId, itemsSynced, conflicts, errors, startedAt, completedAt }`.

### Conflict record shape (tasks.sync_conflicts)
```sql
INSERT INTO tasks.sync_conflicts (user_id, task_id, local_state, remote_state, conflict_type, cycle_id)
VALUES ($1, $2, $3::jsonb, $4::jsonb, 'edit_conflict' | 'delete_conflict', $5)
```

## Security
- HMAC verification stays (first line of defense).
- Never log decrypted tokens.
- Continue processing other users if one fails (isolation).

## Verification
```bash
npm run lint -- server/routes/tasksSync.js
npm run gate:local
```

## Exit
```bash
git add server/routes/tasksSync.js
git commit -m "feat(tasks-sync): implement Google Tasks pull sync with conflict detection"
git push -u origin HEAD
```
