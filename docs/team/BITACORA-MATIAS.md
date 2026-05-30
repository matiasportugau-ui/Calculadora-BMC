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

## 2026-05-21 PM-3 — Wire financial dashboard into the SPA at `/hub/finanzas`

**Contexto:** Auditoría descubrió que el dashboard financiero (KPI Financiero, calendario de vencimientos, próximas entregas, ventas, audit log) ya estaba 100% desarrollado como SPA estática en `docs/bmc-dashboard-modernization/dashboard/` (3,489 LOC) y servido por `express.static` en `/finanzas`, pero **no estaba enlazado** desde la SPA de React. Operadores que no conocían la URL directa nunca lo veían, y el endpoint estaba sin guard de auth — anyone con la URL podía leer KPIs financieros.

**Acciones:**
- Worktree aislado: `worktree-finanzas-hub-integration`.
- Nuevo [`src/components/hub/FinanzasModule.jsx`](../../src/components/hub/FinanzasModule.jsx) — wrapper de iframe sobre `${getCalcApiBase()}/finanzas` reutilizando el patrón ya probado en [`PanelinCalculadoraV3_legacy_inline.jsx:1898`](../../src/components/PanelinCalculadoraV3_legacy_inline.jsx). Incluye link "Pestaña nueva" para ops que quieran full-screen.
- Nueva ruta lazy-loaded `/hub/finanzas` en [`src/App.jsx`](../../src/App.jsx) con `<Shell>` + `<RequireGrant module="finanzas" minLevel="read">` — mismo shape que `/hub/tareas`.
- Nuevo link "Finanzas" en [`src/components/BmcModuleNav.jsx`](../../src/components/BmcModuleNav.jsx) visible sólo para `isAdmin` (mismo gating que Usuarios/Analytics).
- `"finanzas"` agregado a ambos enums backend de módulos: `ALL_MODULES` en [`server/lib/identityAuth.js`](../../server/lib/identityAuth.js) (línea 38) y `ALLOWED_MODULES` en [`server/routes/identityMe.js`](../../server/routes/identityMe.js) (línea 109) — esto hace que el grant sea reconocido por `requireUser` y por el endpoint de access-requests respectivamente.
- Comment block en [`server/index.js`](../../server/index.js) sobre el mount estático documentando la postura de seguridad actual.

**Decisión: iframe vs port-to-React** — iframe-first. Rationale: 3,489 LOC con KPI math no trivial + coupling a la forma del Sheets → portar arriesga drift numérico; el legacy component ya probó el patrón; sin trabajo de CORS (URLs relativas dentro del iframe se quedan same-origin). Reevaluar port en 2–4 semanas según feedback de ops.

**Out-of-scope (follow-up necesario):** El mount estático `/finanzas` Y los endpoints `/api/kpi-financiero`, `/api/calendario-vencimientos`, `/api/ventas`, etc. en [`server/routes/bmcDashboard.js`](../../server/routes/bmcDashboard.js) siguen siendo **públicos**. Gatekeeping sólo del mount estático mientras el API está abierto sería teatro de seguridad. Un follow-up debe gatear ambas capas juntas.

**Verificación:**
- Pendiente al cierre de esta entrada: `npm run gate:local` y smoke manual en `http://localhost:5173/hub/finanzas`.
- Smoke esperado: con sesión + grant finanzas → iframe carga; sin grant → fallback 403 de `RequireGrant`; sin login → `AuthGateModal`.

**Próximo paso:**
- Aprobar y mergear (Phase A).
- Phase B (eval port-a-React) — agendar revisión en 2–4 semanas según feedback de operadores sobre la costura visual.
- Follow-up de seguridad: cerrar el gap de endpoints `/api/*` públicos en `bmcDashboard.js` (PR separado).

**Refs:**
- Plan: `~/.claude/plans/research-the-fiacnial-dashboard-expressive-perlis.md`
- Worktree branch: `worktree-finanzas-hub-integration`
- Patrón reusado: `PanelinCalculadoraV3_legacy_inline.jsx:1898` (iframe a `/finanzas`)
