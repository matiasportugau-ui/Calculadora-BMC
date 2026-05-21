# Activity Log Research — Schema Design Decision

**Author:** Phase 0 of the Unified User Activity Log + History System.
**Date:** 2026-05-21.
**Status:** Recommendation locked. Ready for Phase 1 (schema migration).

---

## 1. Problem Statement

Calculadora BMC needs a unified activity log that powers two distinct surfaces sharing one
data foundation:

1. **Per-user Historial** in `/mi-espacio` — each user browses, filters, and searches their
   own activity to find recent work.
2. **Admin Analytics** at `/hub/admin/analytics` — product team analyzes patterns to drive
   improvements (DAU/WAU/MAU, module usage, funnel conversion, error rates, retention cohorts).

Today, none of the 7 existing logging mechanisms power a per-user UI; none capture the
**union** (business + auth + admin + navigation); and only one is efficiently filterable by
`actor_user_id`.

---

## 2. Repo Audit — 7 Existing Patterns

| # | Pattern | Scope | Persisted? | Helper |
|---|---------|-------|------------|--------|
| 1 | `identity.audit_log` | Auth + admin actions | ✅ infinite | `_audit()` in `server/lib/identityAuth.js:905`, `audit()` in `server/routes/identityAdmin.js:43` |
| 2 | `identity.quote_events` | Per-quote lifecycle | ✅ cascade on quote | Direct INSERT (no helper) |
| 3 | `tk_audit_log` | TraKtiMe business (client/project/invoice/timer/entry) | ✅ infinite, mirrored to Sheets | `tkAudit()` in `server/lib/traktimeAudit.js:8` |
| 4 | `wa_audit_log` | WhatsApp Cockpit operations | ✅ infinite | Direct INSERT in WA routes |
| 5 | `tasks.sync_log` | Google Tasks sync lifecycle | ✅ user-scoped, cascade | Direct INSERT in `server/routes/tasksSync.js` |
| 6 | `toolStats.js` ring buffer | Agent tool latency / error class | ❌ in-memory only | `recordToolCall()` |
| 7 | `identity.users.last_active_at` | Per-request heartbeat | Column update | Implicit in `identityAuth.js:758` |

### Findings

- **No unification surface.** Each table answers a domain-specific question; there's no view
  or table answering "what did user X do across all modules today?"
- **Inconsistent helper APIs.** `_audit()` takes a single object; `tkAudit()` takes `(pool,
  entry, logger)`; `tasks.sync_log` and `wa_audit_log` use direct INSERTs with no helper.
- **Action naming is inconsistent.** Some use dotted strings (`auth.login`,
  `admin.role_grant.add`), some camelCase, some snake_case (`token_refreshed`).
- **No client-side event capture.** `nav.route.change` and `ui.drawer.open` are invisible
  to all logs today.
- **`identity.audit_log` is closest to ideal shape** (has `actor_user_id`, `action`,
  `resource`, `payload`, `at`) — but extending it would dilute its security-audit value with
  business noise.

---

## 3. Industry Best Practices Survey

### 3.1 PostgreSQL Partitioning for Activity Logs

**Sources:**
- [PostgreSQL 18 docs: Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [Data Egret 2025: Data archiving and retention in PostgreSQL](https://dataegret.com/2025/05/data-archiving-and-retention-in-postgresql-best-practices-for-large-datasets/)
- [Viprasol: PostgreSQL Partitioning in 2026](https://viprasol.com/blog/postgres-partitioning-advanced/)

**Key takeaways:**
- Range partitioning on `at` (timestamp) is the standard for time-series.
- **Don't partition tables under 50GB** — planning overhead and complexity outweigh benefits.
- BMC's projected volume (with Business + Nav granularity): ~10M rows/year ≈ ~5GB/year.
  **No partitioning needed for years.**
- Index strategy: a B-tree on `(actor_user_id, at DESC)` covers the Historial use case;
  `(action, at DESC)` covers analytics. Partial index on `(at) WHERE outcome != 'success'`
  cheaply isolates errors.
- `enable_partition_pruning` must remain `on` if/when we partition.

### 3.2 Event Sourcing vs Audit Log

**Sources:**
- [Kurrent: Event Sourcing vs Audit Log](https://www.kurrent.io/blog/event-sourcing-audit)
- [Event-Driven.io: Is audit log a proper architecture driver for Event Sourcing?](https://event-driven.io/en/audit_log_event_sourcing/)
- [Medium / Arnaud Lemaire: Event Sourcing, Audit Logs, and Event Logs](https://medium.com/sundaytech/event-sourcing-audit-logs-and-event-logs-deb8f3c54663)

**Key takeaways:**
- **Audit log** = record what happened (success and failure attempts). Our case.
- **Event sourcing** = events are the source of truth; state rebuilt by replaying them.
  Over-kill for BMC — we'd inherit serialization, versioning, snapshot, and projection
  complexity for marginal benefit.
- "Event sourcing and event stores don't provide full audit log capabilities out of the box"
  — if audit is the only driver, audit log wins.
- BMC already has CRUD state of record (`identity.users`, `identity.quotes`,
  `tk_invoices`, etc.). We just need a parallel append-only history of *interactions*.

**Decision:** Append-only audit-log pattern. Same shape as `identity.audit_log` but with a
broader scope.

### 3.3 OpenTelemetry Semantic Conventions

**Sources:**
- [OpenTelemetry: Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
- [OpenTelemetry: Events](https://opentelemetry.io/docs/specs/semconv/general/events/)
- [OpenTelemetry: Session](https://opentelemetry.io/docs/specs/semconv/general/session/)

**Key takeaways:**
- Common field names matter for future OTLP export and tooling compatibility.
- Adopt: `actor.id`, `event.name` (flat string), `event.outcome`
  (`success`/`failure`/`unknown`), `resource.type` + `resource.id`, `session.id`.
- Our schema maps cleanly: `actor_user_id`, `action`, `outcome`, `resource_type`/`resource_id`,
  `session_id`.

### 3.4 Linear / Notion Activity Feed UX

**Sources:**
- [Notion Help Center: Timeline view](https://www.notion.com/help/timelines)
- [Linear Changelog](https://linear.app/changelog/page/4)
- [UXcel: Activity Feed Best Practices](https://app.uxcel.com/courses/common-patterns/activity-feed-best-practices-646)

**Key takeaways:**
- **Group by relative date**: Today, Yesterday, This Week, Earlier.
- **Filter chips** (not dropdowns) for common dimensions; keeps the UI scannable.
- **Avatar + verb pattern**: "Matías created a quote 3m ago" — explicit subject, verb, object.
- **Inline resource links** wherever possible — "created Cotización #1234".
- **Search box** for finding specific events ("the quote I edited yesterday").

### 3.5 RBAC vs ABAC for SaaS in 2026

**Sources:**
- [TechPrescient: Top 10 RBAC Best Practices for 2026](https://www.techprescient.com/blogs/role-based-access-control-best-practices/)
- [Splunk: RBAC vs ABAC](https://www.splunk.com/en_us/blog/learn/rbac-vs-abac.html)
- [Oso Learn: RBAC vs ABAC](https://www.osohq.com/learn/rbac-vs-abac)

**Key takeaways:**
- **NIST SP 800-162**: RBAC covers ~90% of enterprise applications.
- ABAC adds value only when policies depend on attributes that change too frequently to
  encode as roles (time-of-day, geo, sensitivity tier).
- BMC's existing RBAC (`comprador < operator < admin < superadmin` + per-module level
  grants) is sufficient and properly multi-leveled.
- **No change to permission model in this iteration.** Document hybrid path as a follow-up
  if attribute-based controls ever become necessary (e.g., gate access by `tk_project_members`
  rather than role — already partly handled by the existing membership table).

### 3.6 Multi-Tenant Postgres

**Sources:**
- [Robert Atkinson: Multi-Tenant Audit Logging Architecture Mistakes](https://dev.to/robertatkinson3570/multi-tenant-audit-logging-the-architecture-mistakes-we-made-3m8f)
- [BIX Tech: Multi-Tenant Architecture Complete Guide](https://bix-tech.com/multi-tenant-architecture-the-complete-guide-for-modern-saas-and-analytics-platforms-2/)

**Key takeaways:**
- BMC is single-tenant (one Postgres for one organization). The tenant_id complications
  don't apply.
- Use **Row-Level Security (RLS)** for per-user isolation on a shared table. Users
  `SELECT` their own rows; admin/superadmin `SELECT` any. This is what Supabase enforces
  natively.

---

## 4. Locked Recommendation

### Schema: NEW `identity.user_activity_log` Table (Additive)

```sql
CREATE TABLE identity.user_activity_log (
  event_id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  actor_user_id     uuid REFERENCES identity.users(user_id) ON DELETE SET NULL,
  session_id        uuid REFERENCES identity.sessions(session_id) ON DELETE SET NULL,
  action            text NOT NULL,                  -- flat enum (validated server-side)
  module            text,                            -- 'calc'|'wa'|'ml'|'tareas'|'admin'|'me'|'traktime'
  resource_type     text,
  resource_id       text,
  outcome           text NOT NULL DEFAULT 'success', -- 'success'|'failure'|'pending'|'orphan'
  duration_ms       integer,
  ip                text,
  user_agent        text,
  client_emitted    boolean NOT NULL DEFAULT false,  -- true = from POST /api/me/activity
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  at                timestamptz NOT NULL DEFAULT now()
);
```

**Indexes:**
- `(actor_user_id, at DESC)` — per-user Historial
- `(action, at DESC)` — analytics by event type
- `(session_id)` — session-boundary queries
- partial `(at DESC) WHERE outcome != 'success'` — error analytics, cheap

**Row-Level Security:**
- Users SELECT their own rows
- Admin/superadmin SELECT any (via JWT claim)

### Why NOT extend `identity.audit_log`?

1. `audit_log` is security-audit-canonical. Adding business events (`quote.complete`,
   `nav.route.change`) dilutes its compliance value.
2. `audit_log` lacks `session_id`, `module`, `outcome`, `duration_ms`, `client_emitted` —
   key dimensions for product analytics. Adding columns to an active log table is a long
   `ALTER` lock.
3. Keeping `audit_log` untouched preserves backward compatibility with any future SOC2
   audit or external compliance tooling.

### Action Taxonomy v1 (~40 strings)

Flat dotted strings. Validated server-side against a Set constant in
`server/lib/userActivityLog.js`. Unknown actions warned (not 500'd) — never block a user
action on a logging glitch.

```
auth.session.start         auth.session.end           auth.refresh
auth.mfa_required          auth.token_reuse_detected

admin.role_grant.add       admin.role_grant.remove    admin.module_grant.set
admin.user.suspend         admin.user.reactivate      admin.user.revoke_sessions

quote.draft.create         quote.draft.update         quote.complete
quote.export.pdf           quote.export.csv           quote.send.whatsapp

wa.message.send            ml.respuesta.approve       canales.export

tareas.connect.start       tareas.connect.complete
tareas.list.sync           tareas.task.create

message.thread.create      message.reply              message.read

traktime.timer.start       traktime.timer.stop
traktime.invoice.draft     traktime.invoice.issue

nav.route.change           ui.drawer.open             ui.search.submit
```

### Granularity (locked per user decision)

- Server-side instrumentation captures business + auth + admin events on the route handler
  where the action happens.
- Client-side `POST /api/me/activity` captures **intent events only**: route changes, drawer
  opens, search submits. **Not** every click, keypress, or scroll.
- Debounce client-side at ~5s; flush on logout + `beforeunload`.
- Rate-limit `POST /api/me/activity` at 600/15min per user.

Projected volume: ~50-100 events/user/session × ~5 sessions/week × users = **~10M
rows/year**. Postgres handles this with the indexes above for the next several years; no
partitioning required.

### What stays the same

- All 7 existing logging mechanisms continue to write to their current tables. No data
  migration, no schema changes. `user_activity_log` is **additive**.
- For the ~12 retrofit sites (auth + admin), we **dual-write** — keep the existing
  `identity.audit_log` INSERT, add a `logActivity()` call alongside it. Once the new table
  proves itself in production, a future iteration can deprecate the legacy writes if
  desired (out of scope here).

---

## 5. Out of Scope (Known Follow-Ups)

1. **GDPR-style "delete my history"** — the schema supports it (`DELETE WHERE
   actor_user_id = $1`), but the user-facing UI + verification flow is a separate feature.
2. **Full OTLP export** — schema mirrors OpenTelemetry conventions so we can add an
   exporter later, but not in this iteration.
3. **Cross-instance toolStats aggregation** — `toolStats.js` stays ephemeral; promoting it
   to `user_activity_log` would 10× the volume and dilute the Historial signal.
4. **Real-time streaming** (SSE/WebSockets) — Historial polls on tab open / filter change.
   Real-time can be added later if user demand surfaces.
5. **Mobile-app SDK** — instrumentation lives in the existing React SPA only.

---

## 6. Decisions Locked

| Decision | Choice |
|----------|--------|
| Schema | NEW `identity.user_activity_log`, additive to existing `audit_log` |
| Action taxonomy shape | Flat dotted strings, server-side enum validation |
| Granularity | Business + nav (server-side actions + client-side intent events) |
| Partitioning | None initially (re-evaluate at ~50GB / ~100M rows) |
| RLS | Self-read for users, any-read for admin/superadmin |
| Existing `audit_log` | Untouched — dual-write for retrofits |
| Permission model | RBAC unchanged (no ABAC migration this iteration) |
| Orphan session TTL | 24h (configurable via `ACTIVITY_LOG_ORPHAN_TTL_HOURS`) |
| Frontend polling | On tab open + filter change (no real-time) |

Ready for Phase 1 — schema migration.
