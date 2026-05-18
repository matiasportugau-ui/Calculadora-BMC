# 01 — Architecture: Tareas (Tasks) Module

**Date:** 2026-05-18  
**Scope:** System design, data schema, OAuth PKCE flow, polling strategy, conflict resolution, API contracts.

---

## System Architecture (C4 Container Diagram)

```mermaid
graph TB
    subgraph User["User Layer"]
        Browser["React HUB (Vite)"]
        Mobile["Mobile Browser"]
        GT["Google Tasks App"]
    end
    
    subgraph Frontend["Frontend (Vercel)"]
        HUB["src/components/hub/tasks/<br/>TasksModule.jsx"]
        IDB["IndexedDB Queue<br/>(offline mutations)"]
    end
    
    subgraph Backend["Backend (Cloud Run)"]
        API["Express 5 API<br/>:3001"]
        Routes["server/routes/<br/>tasks*.js"]
        OAuth["OAuth Handler<br/>(PKCE)"]
        Sync["Sync Engine<br/>(polling)"]
    end
    
    subgraph Data["Data Layer (Supabase)"]
        PG[("PostgreSQL<br/>htnwozvopveibwppyjhg")]
        Cache["Runtime Cache<br/>(task metadata)"]
    end
    
    subgraph Google["Google Infrastructure"]
        GTasks["Google Tasks API v1<br/>(https://tasks.googleapis.com)"]
        CloudSched["Cloud Scheduler<br/>(cron trigger)"]
    end
    
    Browser -->|read task lists| HUB
    HUB -->|GET /api/tasks/lists| Routes
    Routes -->|requireUser()| API
    API -->|SELECT * FROM tasks.*| PG
    
    Browser -->|create/update task| IDB
    HUB -->|POST/PATCH| Routes
    Routes -->|verify JWT, check perms| OAuth
    OAuth -->|push mutation| GTasks
    OAuth -->|INSERT sync_log| PG
    
    GT -->|user edits task| GTasks
    CloudSched -->|POST /sync/google-tasks/pull| Sync
    Sync -->|GET tasks.list, updatedMin| GTasks
    Sync -->|UPSERT tasks, INSERT conflicts| PG
    Sync -->|notify HUB| Cache
    
    Mobile -->|sync offline queue| HUB
    IDB -->|after online restore| Routes
```

---

## Data Schema (Supabase PostgreSQL)

[HECHO CONFIRMADO: Supabase schema conventions: UUID PKs, snake_case columns, timestamptz, touch_updated_at() trigger, RLS service_role only.]

### Core Tables

#### `tasks.task_lists`
```sql
CREATE TABLE tasks.task_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  google_task_list_id TEXT NOT NULL,           -- e.g. "@default", custom list IDs
  title TEXT NOT NULL,                          -- e.g. "Mi lista de tareas"
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,             -- soft-delete for sync safety
  
  UNIQUE (user_id, google_task_list_id),
  CHECK (char_length(google_task_list_id) > 0)
);
CREATE INDEX ON tasks.task_lists (user_id, updated_at DESC);
CREATE TRIGGER touch_task_lists_updated_at BEFORE UPDATE ON tasks.task_lists
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- RLS: Service role full access; authenticated users see only own lists
ALTER TABLE tasks.task_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON tasks.task_lists AS permissive FOR ALL TO service_role USING (true);
```

#### `tasks.tasks`
```sql
CREATE TABLE tasks.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES tasks.task_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  google_task_id TEXT NOT NULL,                 -- e.g. "abc123xyz", unique per list
  title TEXT NOT NULL,
  notes TEXT,
  due_date DATE,                                -- RFC 3339 -> ISO 8601 conversion in sync
  status TEXT DEFAULT 'needsAction',            -- 'needsAction' | 'completed'
  position TEXT,                                -- for ordering (opaque to client)
  parent_id UUID REFERENCES tasks.tasks(id),    -- for subtasks
  google_updated TIMESTAMPTZ,                   -- Last known update from Google (for updatedMin)
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,             -- soft-delete; not shown in queries
  
  UNIQUE (list_id, google_task_id),
  CHECK (status IN ('needsAction', 'completed'))
);
CREATE INDEX ON tasks.tasks (user_id, list_id, updated_at DESC);
CREATE INDEX ON tasks.tasks (google_updated) WHERE google_updated IS NOT NULL;
CREATE INDEX ON tasks.tasks (list_id, parent_id) WHERE parent_id IS NOT NULL;
CREATE TRIGGER touch_tasks_updated_at BEFORE UPDATE ON tasks.tasks
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

#### `tasks.oauth_tokens`
```sql
CREATE TABLE tasks.oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES identity.users(user_id) ON DELETE CASCADE,
  
  -- Encrypted at rest (pgp_sym_encrypt or app-layer AES-256; TBD in 05-decisions.md)
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT,
  scope TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE (user_id),
  CHECK (scope LIKE '%tasks%')
);
CREATE TRIGGER touch_oauth_tokens_updated_at BEFORE UPDATE ON tasks.oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
```

#### `tasks.oauth_state`
```sql
CREATE TABLE tasks.oauth_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  state_nonce TEXT NOT NULL UNIQUE,             -- PKCE state parameter
  code_challenge TEXT NOT NULL,                 -- PKCE code_challenge (S256)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  
  CHECK (char_length(state_nonce) >= 32),
  CHECK (char_length(code_challenge) >= 43)
);
CREATE INDEX ON tasks.oauth_state (state_nonce);
CREATE INDEX ON tasks.oauth_state (expires_at) WHERE expires_at > NOW();
```

#### `tasks.sync_log`
```sql
CREATE TABLE tasks.sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,                      -- 'pull' | 'push' | 'conflict_resolve'
  
  -- Pull sync metadata
  next_page_token TEXT,                         -- For resuming if interrupted
  items_synced INT DEFAULT 0,
  items_conflicted INT DEFAULT 0,
  
  -- Error tracking
  error_code INT,                               -- HTTP status (429, 401, 500, etc.)
  error_message TEXT,
  retry_count INT DEFAULT 0,
  
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  CHECK (sync_type IN ('pull', 'push', 'conflict_resolve'))
);
CREATE INDEX ON tasks.sync_log (user_id, started_at DESC);
CREATE INDEX ON tasks.sync_log (error_code) WHERE error_code IS NOT NULL;
```

#### `tasks.sync_conflicts`
```sql
CREATE TABLE tasks.sync_conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks.tasks(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES tasks.task_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity.users(user_id) ON DELETE CASCADE,
  
  conflict_type TEXT NOT NULL,                  -- 'delete_vs_edit' | 'concurrent_edit' | 'state_divergence'
  hub_state JSONB NOT NULL,                     -- Last known HUB version
  google_state JSONB NOT NULL,                  -- Google Tasks API version
  resolution TEXT,                              -- 'hub_wins' | 'google_wins' | 'manual'
  
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES identity.users(user_id),
  
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  
  CHECK (conflict_type IN ('delete_vs_edit', 'concurrent_edit', 'state_divergence')),
  CHECK (resolution IN ('hub_wins', 'google_wins', 'manual') OR resolved_at IS NULL)
);
CREATE INDEX ON tasks.sync_conflicts (user_id, resolved_at DESC NULLS FIRST);
CREATE INDEX ON tasks.sync_conflicts (expires_at) WHERE resolved_at IS NULL;
```

### Identity Module Integration

Add to `identity.modules` seed or migration:
```sql
INSERT INTO identity.modules (slug, display_name, description, enabled)
VALUES (
  'tareas',
  'Tareas',
  'Google Tasks mirror — create, edit, and sync tasks with Google Tasks API',
  TRUE
);
```

Update `ALL_MODULES` in `server/lib/identityAuth.js`:
```javascript
const ALL_MODULES = [
  'calc', 'wa', 'ml', 'admin', 'plan-import', 'agent-admin', 
  'canales', 'crm-personal', 'traktime', 'tareas'  // ADD
];
```

---

## OAuth PKCE Flow (Authorization Code Grant)

[HECHO CONFIRMADO: Existing Google ID-token auth (POST /auth/google) is for IDENTITY only; Tasks OAuth is separate and requires authorization-code + PKCE flow to obtain access_token.]

### Step-by-Step Sequence

```
User (HUB)                     Backend                    Google OAuth               Google Tasks API
    |                             |                             |                           |
    |-- GET /auth/tasks/init ----->|                             |                           |
    |    (no params)               |                             |                           |
    |                              | Generate PKCE challenge    |                           |
    |                              | Store in oauth_state       |                           |
    |                              | Build auth URL             |                           |
    |<-- 303 redirect + URL --------|                             |                           |
    |                              |                             |                           |
    |-- [User clicks "Connect"] ---->|                             |                           |
    |                              |                             |                           |
    |-- Redirected to Google -------->|--- GET /o/oauth2/auth -------->|                    |
    |                              |    (client_id, scope,       |                           |
    |                              |     code_challenge,         |                           |
    |                              |     redirect_uri, state)    |                           |
    |                              |                             |                           |
    |                              |    [User consents]          |                           |
    |                              |                             |                           |
    |    Redirected back w/ code    |<-- 303 + authz_code --------|                          |
    |                              |                             |                           |
    |-- GET /auth/tasks/callback?code=X&state=Y ->|              |                          |
    |                              |                             |                           |
    |                              | Verify state nonce          |                          |
    |                              | Retrieve code_verifier      |                          |
    |                              |                             |                          |
    |                              |--- POST /o/oauth2/token ---->|                          |
    |                              |     (code, client_id,        |                          |
    |                              |      client_secret,          |                          |
    |                              |      code_verifier)         |                          |
    |                              |                             |                          |
    |                              |    [Google verifies S256]   |                          |
    |                              |                             |                          |
    |                              |<-- access_token + expires ---                         |
    |                              |                             |                          |
    |                              | Encrypt & store in          |                          |
    |                              | oauth_tokens table          |                          |
    |                              | Delete oauth_state          |                          |
    |                              |                             |                          |
    |<-- 302 /hub/tasks + JWT --------|                             |                           |
    |                              |                             |                           |
    (User now authenticated for Tasks module)                     |                           |
```

### PKCE Details

**Challenge Generation (Frontend → Backend, GET /auth/tasks/init):**
```javascript
// Backend generates in /auth/tasks/init
const crypto = require('crypto');
const codeVerifier = crypto.randomBytes(32).toString('base64url'); // 43 chars min
const codeChallenge = crypto
  .createHash('sha256')
  .update(codeVerifier)
  .digest('base64url');

// Store in oauth_state:
await pg('tasks.oauth_state').insert({
  user_id,
  state_nonce: generateRandomState(32),
  code_challenge: codeChallenge,
  expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 min TTL
});

// Return to frontend:
return {
  auth_url: `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: config.googleOauthClientId,
    redirect_uri: `${config.appUrl}/auth/tasks/callback`,
    scope: 'https://www.googleapis.com/auth/tasks',
    response_type: 'code',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: state_nonce
  })}`
};
```

**Token Exchange (GET /auth/tasks/callback?code=X&state=Y):**
```javascript
// Backend verifies state, exchanges code
const row = await pg('tasks.oauth_state')
  .where({ state_nonce: state })
  .andWhere('expires_at', '>', new Date())
  .first();

if (!row) throw new Error('Invalid or expired state');

const { code_challenge } = row;
const codeVerifier = row.code_verifier; // Recall from storage

// Exchange with Google
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: config.googleOauthClientId,
    client_secret: config.googleOauthClientSecret,
    code_verifier: codeVerifier,  // <-- PKCE verification
    grant_type: 'authorization_code',
    redirect_uri: `${config.appUrl}/auth/tasks/callback`
  })
});

const { access_token, refresh_token, expires_in } = await tokenResponse.json();

// Encrypt and store
await pg('tasks.oauth_tokens').insert({
  user_id,
  access_token_enc: pgp_sym_encrypt(access_token, config.encryptionKey),
  refresh_token_enc: refresh_token ? pgp_sym_encrypt(refresh_token, config.encryptionKey) : null,
  scope: 'https://www.googleapis.com/auth/tasks',
  expires_at: new Date(Date.now() + expires_in * 1000)
});

// Clean up state
await pg('tasks.oauth_state').where({ id: row.id }).delete();

return { redirectTo: '/hub/tasks' };
```

---

## Polling Strategy (Google → HUB Sync)

[HECHO CONFIRMADO: Google Tasks API v1 — no native webhooks. Sync strategy: polling via Cloud Scheduler cron to /sync/google-tasks/pull, updatedMin RFC 3339 + nextPageToken, max 20K tasks/list, 100K total.]

### Sync Flow

**Trigger:** Cloud Scheduler cron (recommended: `0 */15 * * * *` = every 15 min)

```
Cloud Scheduler                Backend                Google Tasks API
    |                              |                         |
    |-- POST /sync/google-tasks/pull (HMAC) -->|              |
    |  (verify HMAC signature)   |                           |
    |                            |                           |
    |  For each user with token: |                           |
    |  1. Decrypt access_token   |                           |
    |  2. Build updatedMin (RFC 3339) from sync_log.started_at  |
    |  3. GET tasks.list with pageToken iteration             |
    |                            |                           |
    |<--- Batch upsert tasks -------->GET /tasks/list -------->|
    |    Insert conflicts        |  (updatedMin=...)         |
    |    Update sync_log         |                           |
    |                            |<--- tasks[] + nextPageToken --|
    |                            |                           |
    |  If 429 (rate limit):      |                           |
    |  Exponential backoff:       |                           |
    |  - Retry 1: wait 2s        |                           |
    |  - Retry 2: wait 4s        |                           |
    |  - Retry 3: wait 8s        |                           |
    |  - ...                     |                           |
    |  - Retry n: wait min(120s, 2^n)                        |
    |                            |                           |
    |  If 401/403:               |                           |
    |  Token expired/revoked     |                           |
    |  → Mark oauth_tokens stale |                           |
    |  → Notify frontend (offline) |                          |
    |                            |                           |
    |  If 500:                   |                           |
    |  Log error, skip user,     |                           |
    |  continue next             |                           |
    |                            |                           |
    |<-- 200 OK -------------------|                           |
```

### updatedMin Logic (Incremental Sync)

```javascript
// Fetch last successful sync start time for user
const lastSync = await pg('tasks.sync_log')
  .where({ user_id, sync_type: 'pull' })
  .andWhere('completed_at', 'IS NOT', null)
  .orderBy('completed_at', 'desc')
  .first();

// RFC 3339 format (Google Tasks expects this)
const updatedMin = lastSync
  ? new Date(lastSync.completed_at).toISOString()
  : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days back

// GET /tasks/list
const response = await fetch(
  `https://tasks.googleapis.com/tasks/v1/users/@me/lists/${listId}/tasks` +
  `?updatedMin=${encodeURIComponent(updatedMin)}&pageSize=100`,
  { headers: { Authorization: `Bearer ${accessToken}` } }
);

// Continue paging with nextPageToken until exhausted
let nextPageToken = null;
let allTasks = [];
do {
  const data = await response.json();
  allTasks = allTasks.concat(data.items || []);
  nextPageToken = data.nextPageToken;
} while (nextPageToken);
```

### Conflict Detection During Sync

When upserting, compare incoming `updated` (from Google) with local `google_updated`:

```sql
INSERT INTO tasks.tasks (list_id, user_id, google_task_id, title, google_updated, ...)
VALUES ($1, $2, $3, $4, $5, ...)
ON CONFLICT (list_id, google_task_id) DO UPDATE SET
  title = EXCLUDED.title,
  status = EXCLUDED.status,
  google_updated = EXCLUDED.google_updated,
  updated_at = NOW()
WHERE
  -- No conflict: last local edit older than Google's update
  CASE 
    WHEN tasks.google_updated < EXCLUDED.google_updated THEN TRUE
    -- Conflict: simultaneous edit
    WHEN tasks.google_updated >= EXCLUDED.google_updated 
         AND tasks.updated_at > EXCLUDED.google_updated THEN FALSE
    ELSE TRUE
  END;

-- If conflict detected, insert into sync_conflicts table for manual resolution
```

---

## Mutation Flow (HUB → Google Push)

User creates/updates/deletes task in HUB:

```
Frontend                       Backend                  Google Tasks API
  |                              |                            |
  |-- POST /api/tasks/lists/{id}/tasks (JWT) -->|             |
  |   { title, notes, dueDate }   |                            |
  |                              |                            |
  |  [Offline: enqueue in IndexedDB]                         |
  |                              |                            |
  |<-- 200 { id, optimistic } ----|                            |
  |  (show optimistic UI)         |                            |
  |                              |                            |
  |  [Online? proceed]            |                            |
  |                              |                            |
  |                              | requireUser() check       |
  |                              | Fetch oauth_tokens        |
  |                              | Decrypt access_token      |
  |                              |                            |
  |                              |-- POST /tasks/list/{listId}/tasks -->|
  |                              |    Authorization header   |
  |                              |    JSON body              |
  |                              |                            |
  |                              |                   [Google validates]
  |                              |                            |
  |                              |<-- 201 + google_task_id ---|
  |                              |                            |
  |                              | INSERT/UPDATE in DB       |
  |                              | INSERT into sync_log      |
  |                              |                            |
  |<-- WebSocket push (refetch) -|                            |
  |  (real-time list refresh)    |                            |
```

---

## Exponential Backoff (429 Handling)

```javascript
const MAX_RETRIES = 7; // ~2 minutes cumulative
const baseDelayMs = 2000;

async function fetchWithBackoff(url, options, retries = 0) {
  const response = await fetch(url, options);
  
  if (response.status === 429) {
    if (retries >= MAX_RETRIES) {
      throw new Error('Max retries exceeded for Tasks API');
    }
    
    const delayMs = Math.min(120000, baseDelayMs * Math.pow(2, retries));
    console.log(`[tasks-sync] 429 received; retry ${retries + 1} in ${delayMs}ms`);
    
    await new Promise(r => setTimeout(r, delayMs));
    return fetchWithBackoff(url, options, retries + 1);
  }
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}
```

---

## Error Handling Matrix

| HTTP Status | Meaning | Action | Retry? | Log Level |
|-------------|---------|--------|--------|-----------|
| **200–299** | Success | Upsert tasks, increment sync_log.items_synced | N/A | info |
| **401** | Access token invalid/expired | Request refresh OR revoke & notify user | 1× | warn |
| **403** | Scope insufficient OR user revoked | Mark oauth_tokens stale; notify frontend | No | warn |
| **429** | Rate limit (100K/day or per-second) | Exponential backoff (2–120s) | Yes (7×) | info |
| **500–503** | Google backend error | Skip user, log, continue next user | No | error |
| **Other** | Unexpected | Log full response; skip user | No | error |

---

## OpenAPI Patch (Routes to Mount in server/index.js)

```javascript
// tasks.js
app.get('/api/tasks/lists', requireUser(), getTaskLists);
app.post('/api/tasks/lists', requireUser(), createTaskList);
app.get('/api/tasks/lists/:listId', requireUser(), getTaskList);
app.patch('/api/tasks/lists/:listId', requireUser(), updateTaskList);
app.delete('/api/tasks/lists/:listId', requireUser(), deleteTaskList);

app.get('/api/tasks/lists/:listId/tasks', requireUser(), getTasks);
app.post('/api/tasks/lists/:listId/tasks', requireUser(), createTask);
app.get('/api/tasks/lists/:listId/tasks/:taskId', requireUser(), getTask);
app.patch('/api/tasks/lists/:listId/tasks/:taskId', requireUser(), updateTask);
app.delete('/api/tasks/lists/:listId/tasks/:taskId', requireUser(), deleteTask);

// tasksOAuth.js
app.get('/auth/tasks/init', authTasksInit);
app.get('/auth/tasks/callback', authTasksCallback);
app.post('/auth/tasks/revoke', requireUser(), revokeTasksAuth);

// tasksSync.js (Cloud Scheduler target, HMAC-verified)
app.post('/sync/google-tasks/pull', verifyHmac(), syncGoogleTasksPull);
```

---

## Caching & Performance

| What | Where | TTL | Invalidation |
|------|-------|-----|---------------|
| Task list metadata (title, description) | Runtime Cache | 60s | POST/PATCH/DELETE on list |
| Task list items (tasks array) | Frontend IndexedDB | N/A (persistent) | After every successful sync |
| Google access_token | Supabase (encrypted at rest) | varies (Google response, typically 3600s) | On 401, request refresh_token |
| PKCE state nonce | Supabase oauth_state | 10 min | After callback exchange |
| Sync conflict | Supabase sync_conflicts | 7 days (expires_at) | Manual resolution or TTL |

---

## Security Considerations

1. **Token Storage:** Access tokens encrypted in oauth_tokens table (pgp_sym_encrypt or app-layer AES-256; TBD).
2. **PKCE Verification:** code_challenge stored, code_verifier never persisted; S256 hash verified at token exchange.
3. **HMAC Signature:** Cloud Scheduler requests to /sync/google-tasks/pull must include HMAC-SHA256(body, config.cloudSchedulerSecret).
4. **RLS:** All tasks.* tables restrict to service_role (no public/authenticated read via Supabase REST).
5. **JWT Validation:** requireUser() middleware enforces identity on all mutation routes.
6. **Rate Limiting:** Express rate-limit middleware on /auth/tasks/* and /sync/* to prevent brute-force.

---

## Cross-References

- [[00-feasibility.md]] — Verdict: GO (contingent on DATABASE_URL provision)
- [[02-mcp-server.md]] — MCP stack, tools, deployment strategy
- [[03-frontend.md]] — TasksModule.jsx, hooks, offline queue, theme
- [[04-roadmap.md]] — Phase 0–4 milestones, DATABASE_URL blocking item
- [[05-decisions.md]] — ADRs: token encryption, MCP sidecar, OAuth scope
