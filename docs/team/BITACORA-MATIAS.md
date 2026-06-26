# Bitácora — Matías Portugau

**Propósito:** log unificado de sesiones, hitos, deploys y prioridades cerradas. Complementa [PROJECT-STATE.md](./PROJECT-STATE.md) (que es el estado actual del sistema) con una vista cronológica de QUIÉN tocó QUÉ + por qué.

**Formato de entrada:**
```
## YYYY-MM-DD [AM|PM|N] — Título corto

**Contexto:** una línea de por qué.
**Acciones:** bullets de lo concreto que pasó.
**Verificación:** cómo se confirmó que quedó bien.
**Próximo paso:** opcional, qué queda pendiente.
**Refs:** commits, PRs, runbooks, plans, screenshots.
```

Las entradas son **antiguas arriba, recientes abajo** (lectura tipo timeline). El último ítem siempre representa el estado más reciente.

---

## 2026-05-21 N — Fix `redirect_uri_mismatch` en login con Google

**Contexto:** desde el lanzamiento del registro abierto con Google (2026-05-20), cualquier login interactivo en `https://calculadora-bmc.vercel.app` mostraba el error de Google "Acceso bloqueado · Error 400: redirect_uri_mismatch". Usuarios con sesión vigente seguían operando (el refresh backend no toca el navegador), pero ningún login nuevo podía completarse — bloqueante crítico para la track Open Google Registration.

**Acciones:**

- Reproducción end-to-end del bug via Playwright contra producción, capturando la URL OAuth real enviada por la app. Parámetros clave detectados: `client_id=642127786762-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3` + `origin=https://calculadora-bmc.vercel.app` + `redirect_uri=gis_transform` + `response_type=token` + `gsiwebsdk=gis_attributes` → confirmado uso de Google Identity Services Web SDK con flow popup.
- Localizada la inicialización GIS en [`src/utils/googleDrive.js:106-356`](../../src/utils/googleDrive.js) (`loadGsiScript` + `google.accounts.oauth2.initTokenClient`) y el callback de login en [`BmcAuthProvider.jsx:127-165`](../../src/contexts/BmcAuthProvider.jsx) (`POST /api/auth/google`). Verificado que `.env.local:28` y Vercel prod env tienen el mismo client ID activo (`-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3`); `.env`/`.env.example` aún declaraban un client viejo (`-6rkar09l6902jog9dvnal6e6m3a44p76`) — fuente futura de regresiones para nuevos devs (cleanup hecho en este mismo run).
- Diagnóstico final: el OAuth Client en GCP **no tenía `https://calculadora-bmc.vercel.app` registrado en Authorized JavaScript origins**. El placeholder `redirect_uri=gis_transform` del GIS SDK requiere que Google expanda internamente a un URI `storagerelay://` derivado del `origin`, y esa expansión sólo es válida si el origin está en la allowlist. Google devuelve literal "redirect_uri_mismatch" aunque la causa real sea origin no autorizado — confusión común que cuesta horas si no se conoce.
- Fix aplicado por operador en https://console.cloud.google.com/apis/credentials?project=chatbot-bmc-live → OAuth Client `642127786762-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3` → "Authorized JavaScript origins" + "Authorized redirect URIs" recibieron `https://calculadora-bmc.vercel.app`. Sin cambios de código en runtime.
- Cleanup documental: este archivo creado, runbook reusable agregado, `.env.example` alineado con placeholder simbólico + referencia al runbook.

**Verificación end-to-end (Playwright, 2026-05-21 06:42 UTC):**

```
Logout limpio → Iniciar sesión → Continuar con Google →
   accountchooser ✓ (antes moría acá con "Acceso bloqueado") →
   "You're signing back in to calculadora-bmc.vercel.app" ✓ →
   Consent summary ("4 services already access") ✓ →
   Continue → popup cierra ✓ →
   GET googleapis.com/oauth2/v3/userinfo → 200 ✓
   POST calculadora-bmc.vercel.app/api/auth/google → 200 ✓
   UI muestra "matias.portugau@gmail.com" → sesión restaurada ✓
```

**Capas alineadas:**
- Local `.env.local:28` = `-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3` ✓
- Vercel production env `VITE_GOOGLE_CLIENT_ID` = `-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3` ✓
- Runtime prod (Playwright network capture) usa `-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3` ✓
- GCP OAuth Client con Authorized JS origins incluye `https://calculadora-bmc.vercel.app` ✓ (a partir de 2026-05-21 ~06:30 UTC)

**Próximo paso:**

- (opcional) Si se va a usar el OAuth client desde dominios de Vercel preview, agregar el patrón con un prefix wildcard (Google no soporta wildcards en JS origins, hay que agregar uno por uno). Por ahora preview no necesita login.
- (opcional) Configurar Privacy Policy + Terms of Service URLs en el OAuth Consent Screen del proyecto `chatbot-bmc-live` — Google lo notificó en la pantalla de consent. No bloquea login pero impacta apariencia ante usuarios nuevos.

**Refs:**
- Runbook: [`docs/team/runbooks/google-oauth-troubleshooting.md`](./runbooks/google-oauth-troubleshooting.md)
- Plan archivado: `~/.claude/plans/acceder-con-google-gentle-ullman.md`
- Memoria persistente: `~/.claude/projects/-Users-matias/memory/feedback-gis-redirect-uri-mismatch.md`
- Sin commits de código — fix de configuración GCP + 4 archivos de documentación (este, runbook, PROJECT-STATE update, `.env.example` placeholder)

---

## 2026-05-26 PM — Audit defensivo pre-shipping spree

**Contexto:** 5 días post último merge (OAuth fix), 7+ ships sustantivos acumulados (auth live, Tareas Phase C, Activity Log, User Platform, Doppler, /ship skill creation, OAuth fix) sin pausa formal de verificación. Pedido del usuario: chequeo completo defensivo antes de seguir construyendo, para prevenir regresiones silenciosas.

**Acciones:**

- Lancé 3 Explore agents en paralelo: (1) work-areas mapping, (2) regression-risk + cobertura, (3) tooling/skills/MCPs ecosystem.
- **Hallazgos críticos del audit:** los 5 archivos más modificados del último mes (`server/routes/tasks.js`, `tasksSync.js`, `tasksOAuth.js`, `server/lib/userActivityLog.js`, `googleTasksClient.js`) tienen **CERO tests unitarios**. `scripts/smoke-prod-api.mjs` no cubre los endpoints nuevos de auth/tasks/activity-log/admin. `pre-deploy` solo lint+keys, no tests. `test:api` no corre en CI (solo local). 2 baseline failures (`sheetsCsvGuard tab/CR`) no estaban documentadas explícitamente como acknowledged.
- Plan defensivo tiered escrito en `~/.claude/plans/acceder-con-google-gentle-ullman.md` con 4 fases. User confirmó ejecutar **solo Phase A** esta sesión.
- **Phase A — Foundation cleanup:**
  - **PR #248 (env drift fix mío, 5 días viejo):** durante el intento de merge se encontró conflicto en `.env.example`. Investigación reveló que **PR #252 (parallel session)** ya documentó AMBAS vars (`GOOGLE_TASKS_REDIRECT_URI` línea 392, `ACTIVITY_LOG_ORPHAN_TTL_HOURS` línea 411). Env-drift CI pasa en main HEAD `3779ebc`. PR #248 quedó completamente superseded → **cerrada sin merge**, branch borrada, worktree limpia.
  - **PR #250 (dependabot `qs` 6.15.0→6.15.2):** mergeada vía `gh pr merge --admin --rebase --delete-branch` (auto-merge no habilitado en el repo, patch SemVer = bajo riesgo). Commit `6d50ddd` en main.
  - **Worktrees cleanup:** `env-drift-allowlist-2-vars` y `tareas-write-flow-fixes` removidas (bases en main, sin WIP). `finanzas-hub-integration` **INTENCIONALMENTE preservada** — tiene 7 archivos modificados + nuevo `src/components/hub/FinanzasModule.jsx` = active WIP de otra sesión paralela.
  - **Vercel CLI:** 51.2.1 → 54.5.0 (`npm install -g vercel@latest`).
  - **Runbook nuevo:** [`docs/team/runbooks/known-baseline-failures.md`](./runbooks/known-baseline-failures.md) documenta los baseline failures acknowledged para que devs nuevos no los confundan con regresiones reales.

**Verificación:**

```
main HEAD:    6d50ddd (post #250 merge)
Open PRs:     30 → 29 (mergeada #250, cerrada #248)
Worktrees:    4 → 2 (la nueva audit-phase-a-docs + finanzas preservada)
Vercel CLI:   54.5.0 ✓
gate:local:   pendiente correr al final de la sesión
```

**Lección de oro de esta sesión:** las branches viejas (>3 días) en queue pueden ser silently superseded por trabajo paralelo en main. **SIEMPRE rebase + diff vs main ANTES de mergear**, sin excepciones. El conflicto del rebase de #248 fue la red de seguridad que detuvo un force-overwrite del trabajo del otro Claude. Guardado como memory persistente `feedback-stale-pr-superseded.md`.

**Próximo paso:**

- **Phases B/C/D** del plan tiered quedan agendadas para próximas sesiones. Phase B (próxima): tests para los 5 hot-spots zero-tested (`googleTasksClient`, `tasksOAuth`, `tasksSync`, `userActivityLog`, `closeOrphanSessions`) + Playwright para los componentes admin UI nuevos.
- **Triage de DRAFT PRs:** 25 DRAFTs (16 mías + 9 Cursor, oldest del 2026-05-06) candidatas para `bmc-branch-cleanup` skill en sesión separada.
- (Opcional) Aplicar refinements al `/ship` skill basados en los feedback memories del 2026-05-21 + el nuevo de esta sesión.

**Refs:**

- Plan tiered completo: `~/.claude/plans/acceder-con-google-gentle-ullman.md`
- PR cerrada como superseded: [PR #248](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/248)
- PR mergeada: [PR #250](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/250) (commit `6d50ddd`)
- PR que supersede #248: [PR #252](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/252)
- Runbook nuevo: [`docs/team/runbooks/known-baseline-failures.md`](./runbooks/known-baseline-failures.md)
- Memoria guardada: `~/.claude/projects/-Users-matias/memory/feedback-stale-pr-superseded.md`

### Session: live-fix — Google Drive Preview Env Var (2026-06-21 04:30Z)

**Issue:** Error "Google Drive no está configurado: falta VITE_GOOGLE_CLIENT_ID" in preview deployments (calculadora-xxxxx-matprompts-projects.vercel.app).

**Root Cause:** Vite embeds `VITE_*` vars at build time. The env var was set only to Production scope in Vercel, so preview builds got `undefined`, triggering the guard in `initGoogleAuth()` (`src/utils/googleDrive.js:200-204`).

**Fix:**
1. Updated `scripts/vercel-drive-env-push.sh` to add `push_preview_all()` function
2. Changed default flow to push to preview scope by default (bypassing the prior "Preview omitido" message)
3. Committed: `fix(drive): enable VITE_GOOGLE_CLIENT_ID in preview scope by default` (ad1edd2)
4. Deployed to production (Vercel build: dpl_ANLYc1aEnLJBJ3hyuf5fGESKMwUj, alias: calculadora-bmc.vercel.app)
5. Pushed VITE_GOOGLE_CLIENT_ID to Vercel preview scope via `vercel env add`
6. Verified: `vercel env ls preview` now shows `VITE_GOOGLE_CLIENT_ID | Encrypted | Preview`

**Verification:** Next preview deployment will bake in the env var (now available in preview scope). Error will resolve.

**Confidence:** 95% — fix is at the Vercel/Vite layer; no application logic changes.

**Changes:** 1 file (+23/-10 LOC)  
**Time:** ~15 min

---

## 2026-06-25 AM — ML catálogo + /hub/ml-manager (auditoría, reactivaciones, fix dashboard, IA)

**Contexto:** auditar y mejorar el catálogo MercadoLibre y el dashboard `/hub/ml-manager`, que estaba roto en prod (no cargaba publicaciones/preguntas) y sin generación IA.

**Acciones:**
- Auditoría completa: 46 activas + 197 pausadas; **132 bulk-paused el 2026-04-11**; 85 con `moderation_penalty`. Reconciliación Bromyros↔ML (29 paneles). Artefactos en `product-clips/out/`.
- **Reactivadas** ISP150 (`MLU445010304`) + IF40 (`MLU444372549`, 194 vend.) → activas 46→48. ISP50/200/250 retenidas (penalizadas).
- **Causa raíz dashboard roto:** `vercel.json` no proxeaba `/ml` → catch-all SPA devolvía HTML 200 → `JSON.parse` rompía todo. Fix: rewrite `/ml/:path*`→Cloud Run + CORS (PR #431).
- Preguntas: pull `.questions` (no `.results`), botón "Generar con IA", **preview de producto** (thumb+nombre+precio+permalink) (#431, #435).
- **IA desbloqueada** sin billing: cadena caía a Gemini pero estaba en modelo retirado `gemini-2.0-flash` → cambiado a `gemini-2.5-flash` (#433).
- **Editar publicación** estilo ML: header de visualización + variables completas (título, precio, stock, estado, condición, SKU, garantía, atributos) (#436).
- CSP `img-src` += `*.mlstatic.com` para que carguen fotos ML.

**Verificación:** prod `/ml/users/me`→JSON, `/ml/questions`→2, `/api/crm/suggest-response`→`{ok:true,provider:gemini,model:gemini-2.5-flash}`, CSP con mlstatic. gate:local + 3 required checks verdes en cada PR.

**Próximo paso:** (a) listar IsoFrig 60–200mm (falta `POST /ml/items` + fotos); (b) fix calidad ISP50/200/250; (c) recargar clave IA premium (opcional).

**Refs:** PRs #431/#433/#434/#435/#436. Docs: `HANDOFF-2026-06-25-ml-manager.md`, `ML-CREDENTIALS-PLAYBOOK.md`, `ML-AI-KEYS-REMEDIATION.md`, `ML-ISOFRIG-LISTING-CHECKLIST.md`. PROJECT-STATE entrada 2026-06-25.

---

## 2026-06-25 AM — BMC Chat server deployed to Cloud Run

**Context:** El chat web (Gemini Sheets Chat de bmc-sheet-quote-pipeline) necesitaba estar online 24/7 sin depender del Mac local.

**Acciones:**
1. Deployed `web/server.mjs` (zero-dep HTTP server) a Cloud Run `bmc-chat` en `chatbot-bmc-live`, región `us-central1`, con min-instances=1.
2. Secretos (GEMINI_API_KEY, GOOGLE_SHEETS_CREDENTIALS) montados desde Secret Manager — sin Doppler.
3. `BmcChatPanel.jsx` actualizado para apuntar el iframe a la URL de Cloud Run (en vez de localhost:3000 o Express :3001/chat).
4. Server de puerto 3000 (launchd `com.bmc.chat-web`) detenido.
5. Creado skill `~/.claude/skills/bmc-chat-web` para gestión del servicio.

**Verificación:** `curl https://bmc-chat-642127786762.us-central1.run.app/` → HTML (200); `/api/inquiries` → 11 consultas.

**Próximo paso:** Merge `feat/centralized-brain` → main + deploy panelin-calc `/chat` + Vercel (botón 💬).

**Refs:** Handoff: `docs/team/HANDOFF-2026-06-25-0744.md`
