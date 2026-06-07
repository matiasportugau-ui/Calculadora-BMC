# 02 — MCP Server: Tareas Module Integration

**Date:** 2026-05-18  
**Status:** Design spec; implementation deferred to Phase 2+  
**Scope:** Optional MCP server for Tareas module; exposes Google Tasks API operations as tools for Claude agents and future AI features.

---

## Executive Summary

The Tareas MCP server is an **optional-but-recommended** service that exposes Google Tasks operations as structured MCP tools. This enables:

1. **Claude agents** (via `/mcp` route) to query, create, and mutate tasks programmatically.
2. **Future AI features** (e.g., "Claude, add task X to list Y") to work without custom glue code.
3. **Consistent error handling and rate-limit strategy** across all OAuth-backed integrations.

**Decision:** Design as a **sidecar microservice** (separate Cloud Run service or same container, decided in Phase 2 per 05-decisions.md ADR). Implementation deferred to Phase 2–3 (lower priority than core sync engine).

---

## MCP Server Stack Decision

| Dimension | Decision | Rationale |
|-----------|----------|-----------|
| **Language** | **TypeScript + Node.js 24.x** | Matches BMC Express stack; ESM modules; near-zero learning curve for team |
| **Framework** | **@modelcontextprotocol/sdk** (Anthropic MCP stdlib) | Purpose-built for MCP; handles SSE transport, request routing, schema validation |
| **Storage** | **Supabase (same DB as Tasks)** | No new DB; reuse oauth_tokens, task_lists, tasks tables; RLS enforced |
| **Transport** | **Server-Sent Events (SSE)** | MCP spec standard; no bidirectional channel needed; stateless (fits Cloud Run ephemeral containers) |
| **Auth** | **Service account OR JWT from caller** | See Auth Strategy § below; decision in 05-decisions.md ADR |
| **Deployment** | **Google Cloud Run (panelin-calc or separate service)** | Matches existing infra; auto-scaling; secret injection via Secret Manager |
| **Caching** | **In-memory (LRU cache) + Supabase (task_lists, sync_log)** | 60s TTL for list metadata; persistent for sync state |

---

## Tools Table

| Tool Name | Input | Output | Rate Limit | Auth | Notes |
|-----------|-------|--------|------------|------|-------|
| **list_task_lists** | `userId` | `{ lists: [{ id, title, updated }], nextPageToken? }` | 10 req/min | JWT | Fetch user's Google Tasks lists; uses Supabase cache + Google API fallback |
| **get_task_list** | `userId, listId` | `{ id, title, description, updated, taskCount }` | 10 req/min | JWT | Single list metadata; cached 60s |
| **create_task_list** | `userId, title, description?` | `{ id, title, updated, googleId }` | 5 req/min | JWT | POST to Google Tasks API; sync to Supabase; handle 429 exponential backoff |
| **list_tasks** | `userId, listId, pageToken?` | `{ tasks: [{ id, title, due, status, parent }], nextPageToken? }` | 10 req/min | JWT | Fetch tasks in list; paginated with nextPageToken |
| **create_task** | `userId, listId, title, notes?, due?, parent?` | `{ id, title, due, status, googleId, updated }` | 5 req/min | JWT | POST task to Google + Supabase; optimistic return |
| **update_task** | `userId, listId, taskId, { title?, notes?, due?, status? }` | `{ id, title, notes, due, status, updated }` | 5 req/min | JWT | PATCH task on Google + Supabase; handle conflict detection |
| **delete_task** | `userId, listId, taskId` | `{ id, deleted: true, resolvedAt }` | 5 req/min | JWT | Soft-delete on Supabase; PATCH on Google (mark complete, move to trash) |
| **get_sync_status** | `userId` | `{ lastSync, nextSync, itemsSynced, conflicts, pendingMutations }` | Unlimited | JWT | Query sync_log + sync_conflicts; no Google API call |
| **trigger_sync** | `userId, force?` | `{ jobId, status, startedAt }` | 1 req/min | JWT | Enqueue manual /sync/google-tasks/pull for user; returns Cloud Tasks job ID |
| **resolve_conflict** | `userId, listId, taskId, resolution` | `{ id, resolution, resolvedAt, resolvedBy }` | 10 req/min | JWT | Soft-delete + sync_conflicts update; resolution ∈ {take_google, take_hub, manual} |

---

## Auth Strategy

### Access Token Provisioning

1. **Initial Flow (Happens in OAuth route, not MCP):**
   - User triggers `/auth/tasks/init` (POST /auth/tasks/init → 302 to Google OAuth consent screen)
   - User consents → callback to `/auth/tasks/callback?code=X&state=Y`
   - Backend exchanges code → access_token + refresh_token
   - Encrypt at rest (decision: pgp_sym_encrypt or AES-256, see 05-decisions.md) and store in tasks.oauth_tokens

2. **MCP Tool Auth:**
   - Caller (agent or frontend) passes JWT in MCP request headers (`Authorization: Bearer <jwt>`)
   - MCP server verifies JWT signature (issuer: `iss: chatbot-bmc-live`, sub: `userId`)
   - Extract `sub` → `userId` → query tasks.oauth_tokens for that user's encrypted access_token
   - Decrypt token in-memory (never store plaintext in logs or memory)
   - Use access_token to call Google Tasks API; on 401, trigger refresh_token flow

3. **Token Refresh Flow:**
   - Google returns 401 → call POST https://oauth2.googleapis.com/token with refresh_token
   - Get new access_token; update tasks.oauth_tokens (encrypted)
   - Retry original request with new token
   - If refresh fails (401 on refresh), delete row from oauth_tokens + notify user (revoke handler)

4. **Rate Limiting per User:**
   - Track per-user quota in memory (LRU cache):
     ```
     userQuota[userId] = { quota: 100, window: now + 60s, used: 15 }
     ```
   - On each MCP call, increment `used`; if `used > quota`, respond with `{ error: "rate_limit", retryAfter: 60 }`
   - Reset quota at window end; persistent rate_limit tracking in sync_log for audit

---

## Caching & Rate Limit Strategy

### Cache Layers

| Layer | TTL | Hit Rate | Use Case |
|-------|-----|----------|----------|
| **In-Memory (LRU)** | 60s | ~80% | Task list metadata, list counts, user quota state |
| **Supabase (task_lists, tasks)** | N/A (persistent) | ~40% | All synced state; RLS enforced per user |
| **Google Tasks API** | N/A | ~20% | Cache miss after 60s; always authoritative |

### Rate Limit Handling

| HTTP Status | Action | Backoff | Max Retries |
|-------------|--------|---------|-------------|
| **200-299** | Success; update cache + Supabase | N/A | N/A |
| **401** | Token invalid; refresh (see Token Refresh § above) | None (1 immediate retry) | 1 |
| **403** | Scope denied or revocation; graceful degradation | None (fail fast) | 0 |
| **429** | Rate limit hit; exponential backoff | `min(120s, 2s * 2^n)` | 7 (≈2 min total) |
| **500-503** | Service unavailable; skip and continue next cron window | None (don't retry in MCP; log) | 0 |
| **Other** | Unhandled error; log and fail | None | 0 |

**Exponential Backoff Code:**
```typescript
async function withBackoff(fn, maxRetries = 7) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.status !== 429 || attempt === maxRetries) throw err;
      const delayMs = Math.min(120_000, 2000 * Math.pow(2, attempt));
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
```

---

## Deploy Plan

### Option A: Sidecar in Same Cloud Run Container (Recommended Phase 2)

```
Cloud Run Service: panelin-calc
├── Process 1: Express API (server/index.js)
│   └── Mounts tasks routes, tasksOAuth routes, tasksSync routes
├── Process 2: MCP Server (mcp/server.js)
│   └── Listens on :3002 (internal only; no external ingress)
└── Shared storage: env vars, Secret Manager, Supabase connection pool
```

**Advantages:**
- Single deployment unit; no inter-service auth needed
- Shared Supabase connection pool (efficient)
- Shared secret injection via Cloud Run env

**Disadvantages:**
- Crash in MCP brings down API (mitigated by Cloud Run restart policy)
- Resource contention (memory, CPU) if sync spike occurs

**Deployment steps:**
1. Dockerfile: add `node mcp/server.js &` after Express starts
2. Cloud Run revision: increase memory to 512 MB (from 256 MB)
3. Health check: add `/health?module=mcp` to liveness probe
4. CI/CD: MCP tests bundled in `npm run test:api`

### Option B: Separate Cloud Run Service (Future Phase 3+)

```
Cloud Run Service 1: panelin-calc (API)
Cloud Run Service 2: panelin-tasks-mcp (MCP server)
                    └── Calls panelin-calc via internal service-to-service auth
```

**Advantages:**
- Isolated crash domain; MCP failure doesn't affect API
- Horizontal scaling per service
- Easier to debug and monitor separately

**Disadvantages:**
- 2 deployments instead of 1; more ops overhead
- Inter-service auth needed (Workload Identity + JWT)
- Higher latency (network hop between services)

**Decision Deferred:** See 05-decisions.md ADR for Phase 2 trade-off evaluation.

---

## Error Handling Matrix

| Scenario | MCP Response | Logged | User-Facing | Mitigation |
|----------|--------------|--------|-------------|-----------|
| **Task created on Google, sync finds conflict** | `{ error: "conflict_detected", conflictId, taskId }` | ✅ (sync_log) | "Conflict detected; choose Google or HUB version" | sync_conflicts table; manual resolver |
| **User revoked OAuth consent** | `{ error: "auth_revoked", action: "reauthorize" }` | ✅ (oauth_tokens deletion) | "Please reconnect to Google Tasks" | Revoke handler deletes token; /auth/tasks/init link shown |
| **Google Tasks API 429 after 7 retries** | `{ error: "rate_limit_exhausted", retryAfter: 60 }` | ✅ (sync_log) | "Sync paused; will retry in 1 min" | Queue message in UI; next cron window retries |
| **Supabase connection fails** | `{ error: "db_unavailable", status: 503 }` | ✅ (stderr) | "Database temporarily unavailable" | Cloud Run restart; Cloud SQL HA auto-failover |
| **MCP server process crash** | Timeout (no response) | ✅ (Cloud Run logs) | "Service temporarily unavailable" | Cloud Run restart policy (max 3 retries, 30s delay) |
| **Invalid user ID in JWT** | `{ error: "invalid_token", status: 401 }` | ✅ (audit log) | "Authentication failed; please log in again" | Verify JWT in auth middleware |

---

## Webhook Alternative Analysis

### Why Not Webhooks?

**Google Tasks API v1 does NOT support native webhooks.** Alternative approaches evaluated:

| Approach | Latency | Complexity | Cost | Notes |
|----------|---------|-----------|------|-------|
| **Polling (CHOSEN)** | 60s (typical) | Low | ~$8/mo | Cloud Scheduler cron; handles offline gracefully |
| **Webhook via IFTTT** | 2–5s | Medium | ~$10/mo | Third-party service; latency variance; no guaranteed delivery |
| **Pub/Sub (Firebase)** | <1s | High | ~$15/mo | Requires Firebase SDK on client; mobile battery drain |
| **WebSocket (custom)** | <1s | Very High | ~$30/mo | Custom signaling server; connection mgmt overhead; mobile unreliable |
| **GraphQL Subscriptions** | <1s | High | ~$25/mo | Requires separate GraphQL server; ws latency on poor networks |

**Polling wins on simplicity, cost, and offline resilience.** Webhooks deferred to Phase 3+ if real-time becomes a hard requirement.

---

## Monitoring & Observability

### Metrics to Export

| Metric | Type | Dimensions | Threshold |
|--------|------|-----------|-----------|
| `mcp_request_count` | Counter | tool, status, userId | Alert if error_rate > 5% |
| `mcp_request_duration_ms` | Histogram | tool, percentile (p50, p95, p99) | Warn if p99 > 5000ms |
| `google_tasks_api_calls` | Counter | endpoint, status_code | Alert if 429s detected 3+ times/min |
| `oauth_token_refresh_count` | Counter | userId, success | Alert if >10 refreshes/user/day (revocation signal) |
| `sync_conflicts_detected` | Counter | listId, conflictType | Alert if >50 unresolved conflicts |

### Log Destinations

- **Cloud Logging (GCP):** All errors, 429s, token operations (redacted)
- **Sentry (optional Phase 2):** Unhandled exceptions, 5xx responses
- **Datadog (future):** Custom traces for long-running syncs

---

## Deployment Checklist (Phase 2)

- [ ] Write `mcp/server.ts` (MCP server entry point; ~300 LOC)
- [ ] Write `mcp/tools/*.ts` (one file per tool; ~100 LOC each, 10 tools total)
- [ ] Write `mcp/__tests__/tools.test.ts` (contract tests; ~400 LOC)
- [ ] Add MCP tests to CI pipeline (`npm run test:mcp`)
- [ ] Update Dockerfile to start MCP sidecar process (see Option A above)
- [ ] Set Cloud Run memory to 512 MB (from 256 MB)
- [ ] Update Cloud Run health check to include `/health?module=mcp`
- [ ] Secret Manager: ensure `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` are accessible to MCP process
- [ ] Cloud Logging: add alerts for MCP error_rate > 5%
- [ ] Documentation: update AGENTS.md with `/mcp tasks` example usage
- [ ] Staging smoke test: verify `/mcp` endpoint responds on staging Cloud Run
- [ ] Production canary: deploy to 10% traffic first, monitor metrics for 24h

---

## Open Items & TBDs (see 05-decisions.md)

1. **[DUDA ABIERTA] MCP Sidecar Placement** — Same container vs separate Cloud Run service? Trade-off analysis in 05-decisions.md Phase 2 ADR.
2. **[DUDA ABIERTA] Token Encryption Method** — pgp_sym_encrypt (requires pgcrypto extension) vs application-layer AES-256? Decide in 05-decisions.md.
3. **[DUDA ABIERTA] Service Account vs JWT Auth** — MCP calls authenticated via service account (Cloud Run default) vs explicit JWT passed by caller? Resolve in Phase 1 OAuth design.
4. **[INFERENCIA] LRU Cache Eviction** — Proposed 1000-item max cache; confirm memory footprint with actual task_lists data distribution.
5. **[HECHO CONFIRMADO] Cloud Logging API Costs** — Included in GCP commitment; no additional charge for logs generated by Cloud Run services.

---

## Cross-References

- [[01-architecture.md]] — OpenAPI routes that MCP tools wrap; Supabase schema (oauth_tokens, task_lists, tasks, sync_log, sync_conflicts)
- [[04-roadmap.md]] — Phase 2–3 implementation timeline; Phase 2 depends on 01-architecture foundation
- [[05-decisions.md]] — ADRs for sidecar placement, token encryption, service account auth, MCP framework choice
- `/mcp` CLI command documentation in AGENTS.md (future)

---

## Conclusion

The Tareas MCP server is **optional but strategically valuable** for enabling Claude agents and future AI features to manipulate tasks without custom wrapper code. **Phase 2 implementation (after core sync engine is stable)** recommended; defer full deployment to Phase 3 if team capacity is constrained.

**Next step:** Advance to 03-frontend.md + 04-roadmap.md to complete the dossier.
