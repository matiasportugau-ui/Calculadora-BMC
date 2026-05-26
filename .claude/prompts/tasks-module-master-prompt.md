# BMC Hub Tareas Module — Master Prompt para /goal

## 1. Role
Senior full-stack engineer executing **1-week MVP sprint** (calculadora-bmc) — delivery-focused, tradeoff-aware, convention-respecting.

## 2. Context
**Stack confirmado (May 2026):**
- Frontend: **Vite 7** SPA (React 18) + React Router @ `:5173` → `/hub/tareas` nueva ruta
- Backend: **Express 5** + Node.js 24.x @ `:3001` → `server/routes/tasksSync.js` (stub Phase 0, listo para completar)
- Auth: **Google OAuth Web client** (VITE_GOOGLE_CLIENT_ID ya existe)
- Data: **Supabase** (postgres + pgvector, keys template en `.env` pero no pobladas aún)
- Secrets: Vercel (frontend) + Cloud Run env (backend)
- Team auth: **All 4 @bmcuruguay.com.uy + Todoist OAuth activos** ✅
- Mobile: PWA HUB + Todoist native app sync bidireccional (Ramiro/Sandra en obra)

## 3. Goal
**Entregar módulo "Tareas" con Todoist bidireccional, sin costo mensual recurrente (free tier).**
- Usuarios pueden crear/editar/marcar tareas en `/hub/tareas` (browser HUB)
- Sincronización automática: HUB ↔ Todoist ↔ Todoist app mobile (Ramiro/Sandra)
- No acumular deuda técnica; API contracts válidos en todos los cambios.

## 4. Scope (IN / OUT)

### ✅ IN (este sprint)
- **Frontend `src/pages/HubTasks.jsx`**: CRUD UI (React), almacenamiento local/Supabase, list view
- **Backend `server/routes/tasks.js`**: Express routes (GET /tasks, POST, PATCH, DELETE)
- **Backend `server/routes/tasksSync.js`**: Completar Phase 1 (Google Tasks polling, Todoist API, conflict detection)
- **Supabase schema**: `users`, `tasks`, `task_lists`, `oauth_tokens`, `sync_log`, `sync_conflicts` (migrations)
- **Todoist OAuth flow**: `/auth/todoist/callback`, token storage, refresh
- **CI**: `npm run test:contracts` válido para tasks routes; `npm run gate:local` pasa
- **Docs**: Actualizar `docs/team/PROJECT-STATE.md` + `docs/team/TASKS-MODULE-README.md` (nuevo)

### ❌ OUT (siguiente sprint / roadmap)
- WhatsApp integration (tareas por chat)
- Notificaciones en tiempo real (Pusher / SSE)
- Recurring tasks (RRULE)
- Attachments (Drive)
- Team/project grouping (requiere UX y permisos extra)
- Mobile PWA offline sync (aplaza a Sprint 2)

## 5. Constraints (Guardrails)

### Security (non-negotiable)
- ✅ **DGI/fiscal:** Tasks es read-only para auditoría; NO escribe a Sheets CRM_Operativo
- ✅ **Secrets:** OAuth tokens almacenados ENCRYPTED en Supabase (`pgp_sym_encrypt`); nunca plaintext
- ✅ **CORS:** Mismo origen (localhost:5173 dev, calculadora-bmc.vercel.app prod)
- ✅ **HMAC webhook:** `/sync/google-tasks/pull` requiere X-Sync-Signature válida (Cloud Scheduler)

### Cost (billing-conscious)
- ✅ **Todoist free tier:** ≤10 tareas activas por usuario; no pagar premium
- ✅ **Supabase free tier:** ≤500MB storage, ≤50k req/day; bastante para 4 usuarios
- ✅ **Google Tasks API:** Rate limit 600 req/min por user; CloudScheduler cada 60s (OK)
- ✅ **No 3rd-party APIs pagos:** Omitir Slack, Discord, etc.

### Technical (team conventions)
- ✅ ES modules only (`import`/`export`, no `require`)
- ✅ Express route files en `server/routes/<feature>.js`
- ✅ React components en `src/pages/` + `src/components/`
- ✅ Secrets NUNCA hardcoded; via `config.js` o `process.env`
- ✅ Commit messages: `feat: | fix: | refactor: | docs:` (eng, conciso)
- ✅ PRs >500 LOC: DRAFT obligatorio

## 6. Inputs (Datos, credenciales, paths)

### Repos & Files
- **Frontend:** `src/App.jsx` (router), `src/pages/`, `src/components/`
- **Backend:** `server/index.js` (mounts routes), `server/routes/` (tareas, tasksSync)
- **Config:** `server/config.js` (env vars)
- **Secrets:** `.env` (local), Vercel settings (prod frontend), Cloud Run env (prod backend)
- **Migrations:** `db/migrations/` (Supabase SQL)
- **Tests:** `tests/` (jest para routes contract, offline unit tests)
- **Docs:** `docs/team/PROJECT-STATE.md` (actualizar), `docs/team/TASKS-MODULE-README.md` (crear)

### Credentials (template en `.env.example`, values en Vercel/Cloud Run)
```
# Supabase (frente)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# Supabase (backend server-only)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...

# Todoist OAuth
TODOIST_CLIENT_ID=
TODOIST_CLIENT_SECRET=

# Google Tasks (opcional; Todoist es primario)
GOOGLE_TASKS_API_KEY=  # No; usar credenciales de usuario oauth_tokens en BD

# Sync webhook HMAC
SYNC_HMAC_SECRET=  # openssl rand -base64 32
```

## 7. Tools & MCPs (Permisos)
- ✅ **Bash:** npm, git, curl (REST para debug Todoist API)
- ✅ **Read/Edit/Write:** config, route files, migrations, tests
- ✅ **No MCP requerido:** REST es suficiente para Todoist + Supabase client SDK

## 8. Anti-patterns (Failure modes)

| Falla | Síntoma | Prevención |
|-------|---------|-----------|
| **Token plaintext en DB** | OAuth key leaks → account takeover | ENCRYPTED siempre (`pgp_sym_encrypt`); never return plaintext en API response |
| **HMAC bypass** | Cloud Scheduler fake requests crean sync falsos | `verifyHmacSignature()` early return 403 si falla |
| **Todoist rate limit** | 429 response → break sync loop | Exponential backoff + log 429 + skip user + retry next cycle |
| **Stale token** | 401 Todoist → sync breaks | Refresh token; si falla, mark `revoked_at`; alert operator |
| **Conflict: HUB delete vs Todoist active** | 2 sources of truth divergen | Log `sync_conflicts`; mark `is_conflict=true` en tasks; UI muestra "Revisar" |
| **PR oversized** | Merge gate blocks >500 LOC | Splitear: frontend, backend, migrations en commits atómicos |
| **Supabase schema mismatch** | Types mismatch en responses | Generar `generated/supabase-types.ts` via SDK; usar en API routes |
| **Missing tests** | Regresión en calc/prices | `npm run test:contracts` valida shapes antes de commit |

## 9. Deliverables (10 artefactos)

| # | Artefacto | Ruta | Criterio de éxito |
|---|-----------|------|-------------------|
| 1 | **HubTasks component** | `src/pages/HubTasks.jsx` | Renderiza lista + CRUD inputs; no errors en console |
| 2 | **Tasks route (GET/POST/PATCH/DELETE)** | `server/routes/tasks.js` | 4 routes + contract tests pasan |
| 3 | **TasksSync Phase 1 impl** | `server/routes/tasksSync.js` | Polling, conflict detect, sync_log, vuelve `{ ok: true, itemsSynced, conflicts }` |
| 4 | **Todoist OAuth flow** | `server/routes/authTodoist.js` | GET callback; Refresh token en DB encrypted |
| 5 | **Supabase migrations** | `db/migrations/001_tasks_schema.sql` | `users`, `tasks`, `task_lists`, `oauth_tokens`, `sync_log`, `sync_conflicts` tables |
| 6 | **Frontend contract test** | `tests/hubs-tasks-contract.test.js` | Vuelca shapes esperadas; jest pasa |
| 7 | **Docs (Tasks README)** | `docs/team/TASKS-MODULE-README.md` | Architecture, schemas, Todoist webhook, sync flow (diagrama ASCII OK) |
| 8 | **PROJECT-STATE update** | `docs/team/PROJECT-STATE.md` | Agrega "Tareas module v1 entregado; sincronización HUB ↔ Todoist activa" |
| 9 | **Cloud Scheduler config** | `docs/team/CLOUD-SCHEDULER-TASKS-SETUP.md` (nuevo) | HMAC gen, cron expr 60s, pubsub/HTTP target URL |
| 10 | **PR review-ready** | GitHub | Pre-commit gate pasa: `npm run gate:local` + contracts + lint + tests |

## 10. Success Criteria (15 checks binarios)

### Funcionales
- [ ] CREATE tarea en `/hub/tareas` (form input → POST /tasks → Supabase)
- [ ] READ lista de tareas (GET /tasks → Supabase, renderiza sin error)
- [ ] UPDATE tarea (PATCH /tasks/:id → is_completed toggle, title edit)
- [ ] DELETE tarea (DELETE /tasks/:id → soft-delete is_deleted=true)
- [ ] **Todoist OAuth:** Login → token stored encrypted → puede crear tarea → syncs a Todoist app en 60s

### No-funcionales
- [ ] Contracts válidos (`npm run test:contracts` 100% pass)
- [ ] Lint pasa (`npm run lint -- src/pages/HubTasks.jsx server/routes/tasks.js`)
- [ ] Tests unit/integration pasan (`npm test`)
- [ ] No secrets en git (`git grep TODOIST_CLIENT_ID` vacío)
- [ ] Gate local pasa (`npm run gate:local` exit 0)

### Operacionales
- [ ] Todoist sync corre cada 60s sin errores 5xx
- [ ] Conflicts logged en tasks.sync_conflicts (detecta delete en HUB + active en Todoist)
- [ ] Operator puede revisar sync via `/api/tasks/sync-log` (últimas 24h)
- [ ] Docs actualizadas + PROJECT-STATE refrescado

## 11. Operational Anchors (BMC-specific)

### Source of truth hierarchy
1. **Todoist API** = fuente primaria (mobile app, integrations externas)
2. **HUB tareas** = copy local + diff pending (transient)
3. **Supabase** = audit log + recovery

### State labels (DGI compliance)
- `is_deleted`: soft delete (auditable, no se borra)
- `synced_at`: última sync timestamp (prueba de sincronía)
- `is_conflict`: flag si 2 sources divergen (UI: "Revisar")

### Intent classification (future ML)
- Task type hints en DB (para future routing a canales: WA, Sheets, etc.)
- Ejemplos: "Llamar cliente", "Presupuesto", "Seguimiento", "Admin" → tags

## 12. Open Items (→ decidí antes de `/goal`)

- [x] **React arch:** Vite SPA ✅
- [x] **Backend:** server/routes/tasks.js ✅
- [x] **Team:** @bmcuruguay + Todoist ✅
- [x] **Mobile:** PWA + Todoist app ✅
- [x] **Supabase existe:** Keys pending en Vercel/Cloud Run ✅
- [x] **tasksSync.js stub:** Ya existe (Phase 0) → completar Phase 1 ✅

## 13. Blockers
- None at sprint start. If Supabase keys unavailable by sprint day 2 → escalate to @matias.

---

**Ready to execute. Triggered by `/goal` master prompt.**
