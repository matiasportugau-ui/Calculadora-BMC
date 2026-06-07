# 05 — Decisions: Tareas (Tasks) Module ADRs

**Date:** 2026-05-18  
**Status:** Architecture Decision Record (ADR) — decisions deferred from Phase 0, resolved before Phase 1 kickoff  
**Scope:** 8 architectural decisions with Options, Decision, and Consequences for implementation clarity.

---

## 01 — Token Encryption Strategy

**Question:** How should OAuth access_token and refresh_token be encrypted at rest in the Supabase `tasks.oauth_tokens` table?

### Options

**Option A: pgp_sym_encrypt (PostgreSQL native)**
- Use Supabase `pgp_sym_encrypt()` function from pgcrypto extension
- Key stored in environment variable `ENCRYPTION_KEY` (Secret Manager)
- Transparent to application code: SELECT pgp_sym_decrypt(encrypted_token, key) returns plaintext
- Pros: Database-level encryption, native Postgres, no key rotation complexity per-token
- Cons: Requires pgcrypto extension (must verify availability on project htnwozvopveibwppyjhg), key rotation affects all tokens simultaneously

**Option B: Application-layer AES-256 (Node.js crypto)**
- Encrypt in server/routes/tasksOAuth.js before INSERT; decrypt before Google API calls
- Use Node.js `crypto` module with `crypto.createCipheriv('aes-256-gcm', key, iv)`
- Store cipher + iv + authTag in same column or separate columns
- Pros: Fine-grained control, per-token key rotation feasible, no database extension dependency
- Cons: Key management in application code, risk of plaintext in logs if not careful, more complex decrypt-check-decrypt pattern

### Decision

**CHOSEN: Option A — pgp_sym_encrypt (PostgreSQL native)**

Justification: Supabase PostgreSQL is our system of record; leveraging native pgcrypto extension minimizes application-layer encryption bugs and follows principle of "encrypt at storage boundary." Simpler token rotation: regenerate key in Secret Manager → re-encrypt all tokens in one migration. Team already familiar with Supabase PL/pgsql.

### Consequences

1. **Pre-Phase 1 Action:** Verify pgcrypto extension is enabled on Supabase project htnwozvopveibwppyjhg:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```
   If missing, provision via Supabase dashboard or contact operator.

2. **oauth_tokens table design:**
   ```sql
   access_token TEXT NOT NULL, -- stored encrypted: pgp_sym_encrypt(token, secret)
   refresh_token TEXT,         -- stored encrypted if present
   scope TEXT NOT NULL,        -- stored plaintext (scope names are not secret)
   ```

3. **Query pattern in tasksOAuth.js and tasksSync.js:**
   ```sql
   -- SELECT: decrypt on read
   SELECT user_id, pgp_sym_decrypt(access_token::bytea, secret_key) AS access_token
   FROM tasks.oauth_tokens WHERE user_id = $1;
   
   -- INSERT: encrypt on write
   INSERT INTO tasks.oauth_tokens (user_id, access_token, refresh_token, scope, expires_at)
   VALUES ($1, pgp_sym_encrypt($2, secret_key), pgp_sym_encrypt($3, secret_key), $4, $5);
   ```

4. **Secret Management:** ENCRYPTION_KEY (32-byte AES-256 key) must be provisioned in Cloud Run env via Secret Manager before Phase 1 sync routes go live. Operator action required in Phase 1 provisioning checklist.

5. **Audit trail:** All pgp_sym_decrypt calls logged via Postgres audit extension if enabled; no plaintext tokens in application logs.

---

## 02 — MCP Sidecar Placement

**Question:** Should the Tareas MCP server run in the same Cloud Run container as the Express API, or as a separate Cloud Run service?

### Options

**Option A: Sidecar in Same Container (panelin-calc)**
- Dockerfile: start Express on :3001, then start MCP server on :3002 (internal only)
- Shared Supabase connection pool, env vars, Secret Manager access
- Single deployment unit: `npm run build:mcp && gcloud run deploy panelin-calc`
- Cloud Run memory: increase from 256 MB → 512 MB to accommodate both processes
- Pros: Simpler deployment (1 service), no inter-process auth needed, shared connection pool efficiency, aligned with existing panelin-calc container architecture
- Cons: Crash in MCP can bring down API (mitigated by Cloud Run restart policy); resource contention if sync spike occurs; harder to scale MCP independently

**Option B: Separate Cloud Run Service (panelin-tasks-mcp)**
- New Cloud Run service: `panelin-tasks-mcp` in same region (us-central1)
- Express calls MCP internally via Workload Identity + JWT; MCP calls back to Express for Supabase access via internal service-to-service auth
- Independent horizontal scaling: MCP can be scaled separately during sync spikes
- Separate monitoring/logging per service
- Pros: Isolated crash domain (MCP failure doesn't affect API), horizontal scaling per service, easier debugging, aligned with microservices pattern
- Cons: 2 deployments instead of 1 (more ops overhead); inter-service latency (network hop ~50–100ms per call); Workload Identity setup complexity; requires explicit IAM roles (roles/iam.serviceAccountUser)

### Decision

**CHOSEN: Option A — Sidecar in Same Container (Phase 2 implementation)**

Justification: **Phase 0–1 priority is core sync engine + conflict resolution.** MCP is optional (Phase 2+). For Phase 2, Option A provides fastest time-to-value with minimal DevOps overhead. BMC team already operates panelin-calc container with mature deployment pipeline. Separate service can be considered in Phase 3+ if MCP traffic volume warrants independent scaling (current estimate: <10 requests/min per user, negligible CPU).

### Consequences

1. **Dockerfile (Phase 2):** Add sidecar process startup after Express:
   ```dockerfile
   CMD ["/bin/sh", "-c", "node server/index.js & node mcp/server.js"]
   ```

2. **Cloud Run config (Phase 2):** Increase memory allocation from 256 MB → 512 MB (est. 200 MB Express + 100 MB MCP + overhead).

3. **Health checks:** Liveness probe must check BOTH services:
   ```
   GET /health?module=api → 200 if Express running
   GET /health?module=mcp → 200 if MCP running
   ```
   If either fails, Cloud Run auto-restarts container.

4. **Phase 3+ reevaluation trigger:** If sync spike exceeds 100 requests/min during peak hours (detected via monitoring), revisit Option B for independent scaling.

5. **Monitoring:** Bundle MCP metrics (request count, latency, error rate) under same Datadog/Cloud Logging agent as Express; alert on combined error_rate > 5%.

---

## 03 — Cloud Scheduler Service Account Permissions

**Question:** What IAM role should the Cloud Scheduler service account have to invoke `/sync/google-tasks/pull`?

### Options

**Option A: roles/iam.serviceAccountUser**
- Grant `roles/iam.serviceAccountUser` on the Cloud Scheduler default service account (e.g., `123456789@cloudscheduler.iam.gserviceaccount.com`)
- Allows the scheduler to impersonate the panelin-calc Cloud Run service account and invoke the endpoint with OIDC token
- Standard pattern for Cloud Scheduler → Cloud Run invocation

**Option B: Broader Role (roles/run.invoker)**
- Grant `roles/run.invoker` directly to Cloud Scheduler service account
- Allows invoking any Cloud Run service in the project
- Pros: Simpler IAM (one role), no intermediate service account
- Cons: Over-permissioned (scheduler can invoke other services unintentionally)

**Option C: Custom Service Account**
- Create dedicated service account `tareas-sync-scheduler@chatbot-bmc-live.iam.gserviceaccount.com`
- Grant only `roles/run.invoker` on panelin-calc Cloud Run service
- More granular (scheduler identity visible in audit logs as tareas-sync-scheduler, not default scheduler account)
- Pros: Audit trail clarity, least-privilege principle
- Cons: Extra service account to manage

### Decision

**CHOSEN: Option A — roles/iam.serviceAccountUser (Phase 1 provisioning)**

Justification: Standard Cloud Run invocation pattern in BMC infrastructure. Keeps IAM simple while maintaining audit trail (Cloud Scheduler runs as default account, identity visible in Cloud Run request logs). If sync account segregation becomes critical later (Phase 3+), migrate to Option C.

### Consequences

1. **Phase 1 Provisioning Checklist:** Operator must execute:
   ```bash
   gcloud iam service-accounts add-iam-policy-binding \
     $(gcloud run services describe panelin-calc --region us-central1 --format='value(status.credential.serviceAccountEmail)') \
     --member='serviceAccount:123456789@cloudscheduler.iam.gserviceaccount.com' \
     --role='roles/iam.serviceAccountUser'
   ```
   (Replace 123456789 with GCP project chatbot-bmc-live number.)

2. **Cloud Scheduler Cron Job (Phase 1):** Schedule job with HTTP target:
   ```
   Frequency: */15 * * * * (every 15 minutes, UTC)
   URL: https://panelin-calc-q74zutv7dq-uc.a.run.app/sync/google-tasks/pull
   Auth: Add OIDC token (automatic with roles/iam.serviceAccountUser)
   Headers: Add HMAC signature (shared secret in Secret Manager)
   ```

3. **HMAC Verification (Phase 1):** tasksSync.js must validate HMAC on every request:
   ```javascript
   const crypto = require('crypto');
   const signature = req.headers['x-cloud-scheduler-signature'];
   const hmac = crypto.createHmac('sha256', process.env.SYNC_HMAC_SECRET)
     .update(req.body).digest('hex');
   if (!crypto.timingSafeEqual(signature, hmac)) return res.status(403).json({ error: 'Unauthorized' });
   ```

4. **Audit Trail:** Cloud Run request logs show OIDC principal (`serviceAccount:default@cloudscheduler.iam.gserviceaccount.com`) initiating each sync request.

---

## 04 — OAuth Storage Strategy

**Question:** Where should the encrypted OAuth tokens be stored — in Supabase `tasks.oauth_tokens` table, or in Google Cloud Secret Manager?

### Options

**Option A: Supabase oauth_tokens Table (with pgp_sym_encrypt)**
- Store access_token, refresh_token, scope, expires_at in Supabase as encrypted columns
- Pros: Single database for all Tasks data; RLS enforced per user; audit trail via Postgres logs; no cross-service latency (same Supabase connection pool); token_refresh logic can query + update in same transaction
- Cons: Token compromise exposes all Tasks data in same database; key rotation requires Postgres stored procedure; no HSM protection (standard encryption only)

**Option B: Google Cloud Secret Manager**
- Store tokens as Secret Manager secrets with naming: `tareas-oauth-{userId}-access`, `tareas-oauth-{userId}-refresh`
- Supabase stores only secret name and metadata (user_id, created_at, expires_at)
- Pros: HSM-backed encryption (FIPS 140-2 compliant), audit trail via Cloud Audit Logs, key rotation per secret without touching Postgres, separation of concerns (tokens in different system from app data)
- Cons: Cross-service latency (Secret Manager API call per sync), cost (~$0.06 per secret per month, ~$600/year for 10K users), complexity (two systems to manage), slower token refresh (network hop to Secret Manager)

### Decision

**CHOSEN: Option A — Supabase oauth_tokens Table (ADR decision, implementation per 01-decisions-token-encryption)**

Justification: **Performance + Operational Simplicity.** Token refresh happens on every 401 response (frequent, latency-sensitive). Secret Manager adds 100ms+ per call; tolerable for occasional token provisioning, unacceptable for every auth refresh. RLS on Supabase enforces user isolation. Postgres audit trail sufficient for DGI compliance. If FIPS 140-2 HSM becomes requirement (Phase 3+ security hardening), migrate to Secret Manager.

### Consequences

1. **Token Lifecycle:** tasksOAuth.js stores encrypted token in Supabase on callback; tasksSync.js queries + decrypts on every pull; refresh flow updates encrypted token in place.

2. **User Isolation:** RLS on tasks.oauth_tokens enforces `auth.uid() = user_id`, preventing cross-user token leakage even if database is breached.

3. **Disaster Recovery:** Supabase database backup (~1/week) includes encrypted tokens; restore fully restores token state (no secondary Secret Manager sync needed).

4. **Token Rotation (if Postgres key is rotated):** Operator runs migration to re-encrypt all tokens with new key:
   ```sql
   UPDATE tasks.oauth_tokens
   SET access_token = pgp_sym_encrypt(
     pgp_sym_decrypt(access_token::bytea, old_key::bytea),
     new_key::bytea
   );
   ```

5. **Phase 3+ Migration Path:** If FIPS requirement emerges, create Secret Manager secrets on-demand and store secret names in Supabase (backward-compatible schema change).

---

## 05 — Theme Approach

**Question:** How should theme tokens (colors, spacing, typography) for the Tareas module be organized and maintained — Semantic color system vs. utility-first override pattern?

### Options

**Option A: Semantic Color System (chosen in 03-frontend.md)**
- Define colors by semantic purpose: `status.needsAction` (#EF4444), `status.completed` (#10B981), `status.inProgress` (#F59E0B), `conflict.background` (#FEF3C7), `sync.pending` (#93C5FD), etc.
- Exported as JSON/JS tokens consumed by React components via `useTasksTheme()` hook
- Single source of truth; easy dark-mode extension (swap token values)
- Pros: Accessible, maintainable, aligns with BMC palette extension pattern, scales to multiple themes (light/dark/high-contrast)
- Cons: Requires upfront design work; adds abstraction layer

**Option B: Utility-First Overrides**
- Use Tailwind utility classes (e.g., `bg-red-500`, `text-green-600`) inline in JSX
- No centralized token file; colors scattered across components
- Pros: Fast initial dev, familiar Tailwind pattern
- Cons: Hard to enforce consistency, color changes require grep-replace, dark mode requires conditional classes everywhere, audit trail lost

### Decision

**CHOSEN: Option A — Semantic Color System (03-frontend.md authoritative)**

Justification: Reflects BMC brand strategy (Navy + Amber base, extended semantically). DGI audit in progress — audit trail of color decisions (why red for needsAction, why green for completed) matters for operational clarity. Aligns with existing traktime/crm-personal module patterns.

### Consequences

1. **Theme Tokens File:** `src/theme/tasks.tokens.json` (or `.js` export):
   ```json
   {
     "color": {
       "status": {
         "needsAction": "#EF4444",
         "completed": "#10B981",
         "inProgress": "#F59E0B",
         "delegated": "#8B5CF6"
       },
       "conflict": {
         "background": "#FEF3C7",
         "border": "#F59E0B",
         "text": "#92400E"
       },
       "sync": {
         "pending": "#93C5FD",
         "inProgress": "#FBBF24",
         "error": "#FCA5A5",
         "success": "#BBF7D0"
       }
     },
     "spacing": { "xs": "4px", "sm": "8px", ... },
     "typography": { "h1": { "fontSize": "24px", "fontWeight": 700 }, ... }
   }
   ```

2. **useTasksTheme() Hook:** Exposes tokens to React components:
   ```javascript
   const { color, spacing, typography } = useTasksTheme();
   return <div style={{ backgroundColor: color.status.needsAction, padding: spacing.md }} />;
   ```

3. **Dark Mode Extension (Phase 2+):** Create `tasks.tokens.dark.json` with same structure, different values; hook selects based on `prefers-color-scheme` media query.

4. **Tailwind Integration (optional):** Can extend Tailwind config to consume theme tokens as Tailwind colors:
   ```js
   // tailwind.config.js
   theme: {
     extend: {
       colors: {
         'tasks-status-action': '#EF4444',
         'tasks-status-completed': '#10B981',
         ...
       }
     }
   }
   ```

---

## 06 — OAuth Scope

**Question:** Which Google Tasks OAuth scope should be requested — full read+write (`https://www.googleapis.com/auth/tasks`) or read-only (`.readonly`)?

### Options

**Option A: Full Read+Write Scope (https://www.googleapis.com/auth/tasks)**
- Allows create, update, delete, complete tasks
- Required for full bidirectional sync (HUB → Google mutations)
- Pros: Complete feature set, no user permission surprises at mutation time
- Cons: Broader permission request on OAuth consent screen (higher friction), higher security surface

**Option B: Read-Only Scope (https://www.googleapis.com/auth/tasks.readonly)**
- Allows only list and get tasks
- Mutations (create/update/delete) fail at Google API with 403 Forbidden
- Pros: Minimal permission, lower consent screen friction, user sees "Tasks module will read your tasks"
- Cons: Feature-incomplete (HUB → Google mutations blocked), poor UX (mutations appear to work offline, fail on sync)

### Decision

**CHOSEN: Option A — Full Read+Write Scope**

Justification: Tareas module design requires bidirectional sync (user creates task in HUB → syncs to Google within 60s). Read-only scope makes HUB a view-only mirror, defeating module purpose. Consent screen friction is acceptable cost for feature completeness. User expects "sync my tasks both ways."

### Consequences

1. **OAuth Init (tasksOAuth.js):** Request scope on consent screen:
   ```javascript
   const scope = 'https://www.googleapis.com/auth/tasks';
   const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
     client_id: config.googleOauthClientId,
     redirect_uri: `${config.apiBase}/auth/tasks/callback`,
     response_type: 'code',
     scope: scope,
     // ... PKCE challenge, state
   })}`;
   ```

2. **Consent Dialog:** User sees "Calculadora-BMC is requesting access to manage your tasks in Google Tasks" (phrasing from Google OAuth scopes). Higher friction than read-only, but matches feature set.

3. **Scope Validation (tasksSync.js):** On token refresh, check that stored scope includes `tasks` (not just `.readonly`). If mismatch detected, log alert + graceful degradation (block mutations, allow read).

4. **Phase 3+ Option:** If read-only mode becomes valuable (e.g., import-only flow), add dual scope support (two OAuth flows: full for HUB↔Google, read-only for Google→HUB import-only).

---

## 07 — Demo Artifact Medium

**Question:** What format should the Phase 0 demo artifact take — Figma prototype, Storybook, or live HTML demo page?

### Options

**Option A: Figma Prototype**
- Static mockups of TasksModule views (TaskListPicker, TaskListDetail, ConflictResolver) in Figma team file
- Interactive flows (click "Create Task" → see form open)
- Pros: Design stakeholders immediately see visual direction; easy to iterate; Figma comments for feedback loop
- Cons: No functional code connection; demo goes stale if component tree changes; Figma-specific tool (may not all team members have access)

**Option B: Storybook**
- React component stories for TasksModule, TaskListItem, ConflictBanner, ConflictResolver
- Live Storybook instance shows component variations (loading state, error state, resolved conflict, etc.)
- Pros: Functional components executable; tied to actual code (stale-proof); design+dev collaboration; accessibility checkers (Axe addon)
- Cons: Requires component implementation (Phase 1+ scope); Storybook setup overhead; not traditionally "design artifact"

**Option C: Live HTML Demo Page**
- Single `docs/hub-tasks-module/demo/index.html` with hardcoded mock data, vanilla JS + Tailwind
- Interactive demo: click "Create task" → adds row to DOM, shows offline queue, manually trigger sync, see conflict resolver
- Pros: Zero dependencies (works offline), self-contained, illustrates full flow without implementation
- Cons: Fragile (demo HTML goes stale), no connection to actual code, maintenance burden

### Decision

**CHOSEN: Option C — Live HTML Demo Page (Phase 0 artifact, documented in docs/hub-tasks-module/demo/)**

Justification: **Phase 0 is documentation phase.** Storybook (Option B) requires component implementation, which is Phase 1+. Figma (Option A) is design-only. HTML demo bridges gap: non-technical stakeholders see interaction flow (offline queue, conflict resolver UI), developers see exact HTML they'll implement. Self-contained, zero npm dependencies.

### Consequences

1. **Demo Structure:**
   ```
   docs/hub-tasks-module/demo/
   ├── index.html (main page with embedded JS + Tailwind)
   ├── README.md (how to view: npx http-server or open index.html directly)
   └── screenshot.png (optional: screenshot of demo state for documentation)
   ```

2. **Demo Features (mock data, no backend):**
   - TaskList with 3 sample tasks (completed, needsAction, inProgress)
   - "Create Task" form (opens on click)
   - Offline queue indicator (shows "2 pending mutations" if offline)
   - Sync status (last sync 30s ago, next sync in 30s)
   - Manual sync button (increments sync count, shows spinner)
   - Conflict resolver UI (side-by-side task versions with "Keep HUB" / "Keep Google" buttons)

3. **Accessibility Checklist (demo must meet WCAG 2.1 AA):**
   - ✅ Keyboard navigation (Tab/Enter to interact with buttons)
   - ✅ Color contrast ≥4.5:1 (navy #0F2B46 on white, red #EF4444 on white, etc.)
   - ✅ aria-labels on buttons and task items
   - ✅ Focus indicators ≥3px
   - ✅ No flash/animation >3 flashes/sec (no seizure risk)

4. **Phase 1+ Transition:** Once components are implemented in Phase 1, replace HTML demo with Storybook instance for ongoing design+dev collaboration.

---

## 08 — Virtual Scrolling Threshold

**Question:** When should the TaskList component enable virtual scrolling (windowing) to improve performance for large task lists?

### Options

**Option A: Fixed Threshold (100 tasks)**
- Enable virtual scrolling if task count > 100 in a single list
- Simple heuristic, predictable behavior
- Pros: Easy to implement and test (always same threshold)
- Cons: Arbitrary (100 tasks may be fast on desktop, slow on mobile); ignores device capabilities

**Option B: Fixed Threshold (500 tasks)**
- Enable at 500+ tasks (Google Tasks API max 20K tasks/list, but rare in practice)
- More conservative, simplifies DOM
- Pros: Covers edge case power users; minimal perf impact until threshold
- Cons: Unnecessary complexity for 99% of users

**Option C: Adaptive Threshold**
- Measure renderTime of TaskList component; if >100ms, enable virtual scrolling
- Start with all tasks in DOM; if perf degrades, auto-switch to windowed mode
- Pros: Responsive to actual performance, works across device types
- Cons: Complex to implement, requires performance monitoring, potential jank during threshold crossover

### Decision

**CHOSEN: Option A — Fixed Threshold (100 tasks), with Phase 2+ adaptive logic**

Justification: **Phase 1 MVP:** Implement fixed threshold (100 tasks) for simplicity. Typical user has 10–50 tasks/list. Threshold won't be hit in Phase 1. Phase 2 (frontend polish) can add adaptive logic if telemetry shows users hitting 100+ tasks.

### Consequences

1. **Implementation (Phase 1, useTasks.js):**
   ```javascript
   const VIRTUAL_SCROLL_THRESHOLD = 100;
   const isLargeList = tasks.length > VIRTUAL_SCROLL_THRESHOLD;
   
   return isLargeList ? (
     <VirtualizedTaskList tasks={tasks} itemHeight={60} windowHeight={400} />
   ) : (
     <PlainTaskList tasks={tasks} />
   );
   ```

2. **VirtualizedTaskList Component (Phase 2):** Use `react-window` library (48KB, common in BMC projects):
   ```javascript
   import { FixedSizeList } from 'react-window';
   // Render visible window of tasks; DOM contains only ~10 visible items
   ```

3. **Testing (Phase 1):** Create mock with 150 tasks; verify virtual scroll kicks in, list remains responsive.

4. **Phase 2+ Metrics:** Collect render times, scroll FPS; if average render time >50ms below threshold, lower to 80. If >200ms at threshold, investigate component optimization (memoization, key strategy).

5. **Accessibility note:** Virtual scrolling can break keyboard navigation if not carefully implemented. Phase 2 checklist: verify Tab/Shift+Tab still reaches all tasks when list is windowed.

---

## Cross-References

- [[00-feasibility.md]] — Feasibility verdict that frames these decisions as Phase 1 prerequisites
- [[01-architecture.md]] — Detailed schema design (token encryption method from this ADR), OAuth PKCE flow (scope from this ADR), polling strategy (Cloud Scheduler IAM from this ADR)
- [[02-mcp-server.md]] — MCP sidecar placement decision (this ADR) affects deployment plan
- [[03-frontend.md]] — Theme tokens system (this ADR), virtual scrolling component (this ADR)
- [[04-roadmap.md]] — Phase 1 provisioning checklist references this ADR for Cloud Scheduler IAM, token encryption verification, OAuth scope request
- [[CLAUDE.md]] (line 124) — DATABASE_URL blocker applies to all database-backed decisions (token storage in Supabase)

---

## Decision Log

| ADR # | Title | Status | Phase Introduced | Owner |
|-------|-------|--------|------------------|-------|
| 01 | Token Encryption Strategy | ✅ Decided: pgp_sym_encrypt | Phase 1 | Arch |
| 02 | MCP Sidecar Placement | ✅ Decided: Same Container (Phase 2) | Phase 2 | DevOps |
| 03 | Cloud Scheduler Service Account | ✅ Decided: roles/iam.serviceAccountUser | Phase 1 | DevOps |
| 04 | OAuth Storage Strategy | ✅ Decided: Supabase oauth_tokens | Phase 1 | Arch |
| 05 | Theme Approach | ✅ Decided: Semantic Color System | Phase 0 | Frontend |
| 06 | OAuth Scope | ✅ Decided: Full Read+Write | Phase 1 | Backend |
| 07 | Demo Artifact Medium | ✅ Decided: Live HTML Demo Page | Phase 0 | Docs |
| 08 | Virtual Scrolling Threshold | ✅ Decided: Fixed Threshold (100 tasks) | Phase 1 | Frontend |

---

## Conclusion

These 8 ADRs establish architectural ground truth for Phase 1 implementation. **All decisions are resolved and forward-compatible** — no ambiguity remains that would block kickoff.

**Pre-Phase 1 checklist (from these ADRs):**
- [ ] Verify pgcrypto extension enabled on Supabase project htnwozvopveibwppyjhg (ADR 01)
- [ ] Provision ENCRYPTION_KEY in Cloud Run Secret Manager (ADR 01)
- [ ] Grant roles/iam.serviceAccountUser on panelin-calc Cloud Run service to Cloud Scheduler (ADR 03)
- [ ] Confirm GOOGLE_OAUTH_CLIENT_ID secret in Secret Manager (ADR 06)
- [ ] Provision SYNC_HMAC_SECRET in Cloud Run Secret Manager (ADR 03)

**Next step:** Phase 1 kickoff with implementation of tasksOAuth.js (PKCE flow) + tasksSync.js (polling) + frontend stubs (useTasks hook).

