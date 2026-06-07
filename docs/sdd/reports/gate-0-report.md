# Reporte de evidencia — Gate 0 (Seguridad previa)

- **Proyecto:** Tablero de Workflows BMC ("Proyecto Tablero") — SDD `docs/sdd/DOCUMENTO-MAESTRO.md` §3
- **Decisión base:** ADR-0001 (Aceptado)
- **Fecha:** 2026-06-07
- **Branch:** `claude/gate-0-security-Uw1uv`
- **Ejecutor:** Claude Code (sesión Gate 0)
- **Estado global:** **Código + tests listos.** Acciones de producción **bloqueadas** esperando el "go" de Matias.

> **Regla aplicada:** ningún valor de secreto fue impreso, logueado ni commiteado. Los secretos se nombran, nunca se muestran. Ninguna acción que mute producción (branch protection, rotación, provisión de secretos, redeploy) se ejecutó sin tu "go" explícito.

---

## Resumen por ítem

| # | Ítem Gate 0 | Estado | Evidencia |
|---|-------------|--------|-----------|
| — | Volcar ADR-0001 + Documento Maestro | ✅ Hecho | commit docs (verbatim) |
| — | CLAUDE.md enseña vocabulario SDD | ✅ Hecho | sección "Proyecto Tablero (SDD)" |
| 1 | Branch protection en `main` | ⛔ Bloqueado (prod, sin `gh`) | pasos manuales abajo |
| 2 | Rotar `API_AUTH_TOKEN` | ⚠️ Parcial: ya en Secret Manager; rotación de valor = prod | test ya existente cubre 401/503 |
| 3 | HMAC obligatorio en webhook ML | ✅ Código + test (activación = redeploy) | `webhookGate.js`, `webhookGate.test.js` |
| 4 | HMAC obligatorio en webhook WhatsApp | ✅ Código + test (activación = redeploy) | `webhookGate.js`, `webhookGate.test.js` |
| 5 | Setear + exigir `WEBHOOK_VERIFY_TOKEN` | ✅ Código (exige); ⛔ valor a Secret Manager = prod | `webhookGate.js` |
| 6 | OAuth state → Postgres (ML + Shopify) | ✅ Código + migración + test | `oauthStateStore.js`, migración, `oauthStateStore.test.js` |

---

## Detalle por ítem

### Documentos de gobernanza (precondición del SDD)
- `docs/adr/ADR-0001.md` y `docs/sdd/DOCUMENTO-MAESTRO.md` commiteados **verbatim** (sin traducir ni reformatear).
- `CLAUDE.md`: nueva sección **"Proyecto Tablero (SDD)"** que resume Constitución (override), Fases/Gates, WIP=1 (bloqueante), DSL, reportes de evidencia y Gate 0 — sin duplicar los documentos.

### Ítem 1 — Branch protection en `main` ⛔ BLOQUEADO (requiere tu "go" + credenciales admin)
**Por qué está bloqueado:** este entorno **no tiene `gh` CLI** ni una tool MCP de branch-protection, y es una acción que muta producción. Verificado en `.github/workflows/ci.yml` los nombres exactos de los checks a exigir.

**Pasos manuales (copiá/pegá una vez que des el "go"):**
```bash
# Requiere un token con scope admin sobre el repo
gh api -X PUT repos/matiasportugau-ui/Calculadora-BMC/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[contexts][]=Validate Calculations' \
  -f 'required_status_checks[contexts][]=Lint Check' \
  -f 'required_status_checks[contexts][]=Env drift' \
  -F 'enforce_admins=true' \
  -f 'required_pull_request_reviews[required_approving_review_count]=1' \
  -F 'restrictions=null' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false'
```
Equivalente por UI: *Settings → Branches → Add rule* sobre `main`: ✔ Require a pull request before merging, ✔ Require status checks to pass (seleccionar **Validate Calculations**, **Lint Check**, **Env drift**), ✔ Require branches to be up to date, ✔ Do not allow bypassing / Include administrators, ✘ Allow force pushes, ✘ Allow deletions.

**Criterio de verificación tras aplicar:** un `git push` directo a `main` sin PR + CI verde es rechazado.

### Ítem 2 — Rotar `API_AUTH_TOKEN` ⚠️ PARCIAL (ya migrado; rotación de valor = prod)
**Re-verificación:** `API_AUTH_TOKEN` **ya está en Secret Manager** (`docs/procedimientos/SECRETS-MIGRATION.md`, completado 2026-04-30) y se lee vía `config.apiAuthToken` (`server/config.js`), enforced por `server/middleware/requireServiceOrUser.js`. No hay valor hardcodeado.

**Test ya existente** (`tests/auth-routes.test.js`) cubre el contrato pedido — no se agregó test redundante:
- token inválido → **401** (`POST /api/agent/voice/session` con `x-api-key: "wrong-token"`).
- sin `API_AUTH_TOKEN` configurado → **503** (`/api/wolfboard/pendientes`, `/api/agent/quote-lead`).
- token válido (Bearer / x-api-key) → **200**.

La semántica "el token viejo devuelve 401" se cumple por construcción: al rotar el valor en Secret Manager, cualquier request con el valor viejo cae en la rama "token inválido → 401" ya testeada.

**Runbook de rotación (ejecutar sólo con tu "go"):**
1. Generar valor nuevo (p. ej. `openssl rand -hex 32`) — **no se imprime aquí**.
2. Cargarlo en `.env` local y correr `./scripts/provision-secrets.sh` (crea nueva versión del secret en GCP).
3. Redeploy de Cloud Run `panelin-calc` para tomar la nueva versión.
4. Verificar que un request con el valor viejo → 401 y con el nuevo → 200.

### Ítems 3 + 4 — HMAC obligatorio en webhooks ML y WhatsApp ✅ CÓDIGO + TEST
**Re-verificación del gap:** el HMAC **existía pero era opcional** — se salteaba (`verified.skipped`) cuando faltaba el secret (`ML_CLIENT_SECRET` / `WHATSAPP_APP_SECRET`). Eso es exactamente "acepta requests sin validación" cuando el secret no está.

**Fix:** nuevo helper puro `server/lib/webhookGate.js` (`shouldRejectWebhook`) — fail-closed:
- firma inválida/ausente → rechaza (401);
- secret no configurado (`skipped`) → **rechaza** en cualquier entorno ≠ `test` (antes pasaba);
- `appEnv === "test"` → no rechaza (las suites offline corren sin secrets).

Cableado en `server/index.js` para `/webhooks/ml` y `/webhooks/whatsapp`. Patrón de helper puro elegido porque `server/index.js` no exporta `app` y auto-`listen`a con workers, así que un test de ruta levantaría todo el server; el repo ya usa este patrón (`tests/mlSignature.test.js`).

**Activación:** el código rechaza; el comportamiento sólo cambia en el **redeploy**, que está gateado por tu "go" tras provisionar los secrets (ver ítem 5).

### Ítem 5 — Exigir `WEBHOOK_VERIFY_TOKEN` ✅ CÓDIGO / ⛔ valor a Secret Manager
**Re-verificación:** `config.webhookVerifyToken` (`server/config.js:44`) **default vacío**; la verificación Layer-2 sólo corría si estaba seteado (opcional).

**Fix:** `shouldRejectVerifyToken` en `webhookGate.js` lo hace **requerido** fuera de `test`: token no configurado → rechaza (fail-closed); configurado pero distinto → rechaza. Cableado en el handler ML de `server/index.js`.

**Bloqueado (prod):** el **valor** del token va a Secret Manager vía `./scripts/provision-secrets.sh` (clave `WEBHOOK_VERIFY_TOKEN`, ya listada como HIGH_SENS_KEY). Nunca al código ni a este reporte.

### Ítem 6 — OAuth state → Postgres (ML + Shopify) ✅ CÓDIGO + MIGRACIÓN + TEST
**Re-verificación:** Google Tasks **ya** persiste en Postgres (`tasks.oauth_state`). **ML** (`oauthStates` Map en `server/index.js`) y **Shopify** (`oauthStateStore` Map en `server/routes/shopify.js`) seguían **in-memory** → se perdía estado en restart/scale de Cloud Run (anti-patrón prohibido por la Constitución §1.7).

**Fix:**
- Migración `supabase/migrations/20260607000001_oauth_state_generic.sql`: tabla `public.oauth_state` (`state` PK, `provider`, `code_verifier`, `meta jsonb`, `expires_at`), genérica y sin FK (estos flujos no tienen usuario logueado, a diferencia de `tasks.oauth_state`).
- `server/lib/oauthStateStore.js`: `saveOauthState` + `consumeOauthState` con **consume atómico single-use** (`DELETE ... RETURNING` + guard `expires_at > now()`). Fallback in-memory cuando falta `DATABASE_URL` (preserva el contrato en dev/test).
- ML y Shopify migrados a estas funciones; eliminados los Maps y el `ensureValidState`/`pruneStateStore`.

**Verificación de reuse:** `tests/oauthStateStore.test.js` — un `state` ya consumido devuelve `null` al reintentarse (reuse rechazado), expiry rechazado, y provider-mismatch rechazado, tanto en el camino SQL (pool fake que replica `DELETE ... RETURNING`) como en el fallback in-memory.

---

## Salidas de tests (verdes)

Nota de entorno: el hook de arranque generó `.env` desde `.env.example` con **claves de IA placeholder** (`OPENAI_API_KEY=sk-your-...here`). Eso hace que `tests/rag.test.js` intente una llamada real a OpenAI (falla con 401 de OpenAI) cuando la clave placeholder está presente. Es ruido ambiental, ajeno a Gate 0; con las claves neutralizadas el test pasa 36/36.

### Tests nuevos de Gate 0
```
$ node tests/webhookGate.test.js
webhookGate tests OK (11/11)

$ node tests/oauthStateStore.test.js
oauthStateStore tests OK (6/6)
```

### Test ya existente que cubre el ítem 2
```
$ node tests/auth-routes.test.js
AUTH RESULTS: 8 passed, 0 failed, 8 total
```

### Suite offline `npm test` (con claves IA placeholder neutralizadas)
```
$ OPENAI_API_KEY="" ANTHROPIC_API_KEY="" GEMINI_API_KEY="" GROK_API_KEY="" npm test
... RAG tests: 36 passed, 0 failed
mlSignature tests OK (8/8)
webhookGate tests OK (11/11)
npm test exit: 0
```

### Lint (alcance del proyecto = `src/`)
```
$ node_modules/.bin/eslint src/
✖ 10 problems (0 errors, 10 warnings)   # warnings preexistentes en archivos no tocados
eslint exit: 0
```
`eslint src/` es el alcance que define `package.json` (`"lint": "eslint src/"`). Mis cambios viven en `server/` y `tests/`; se validaron con `node --check` (sintaxis OK) y con las suites.

### Escaneo de secretos en el diff
```
$ git diff <base>..HEAD -- server/ tests/ supabase/ | grep <patrones de secreto>
--- scan done (no hits = clean) ---
```
Sin valores de secreto hardcodeados; sólo nombres de variables y placeholders de test.

---

## Fallos PREEXISTENTES detectados (no son de Gate 0, no se tocaron)

Verificados contra el commit base `3153b11` (antes de Gate 0):
1. **`tests/identity-auth.test.js`** — 2 subtests RBAC fallan (`403 when role check fails`, `403 when module level check fails for a comprador on /api/wa`). Reproducido en el commit base (`# pass 14 / # fail 2`). Causa: drift del shim de `pg` en el test (no maneja `insert into identity.user_activity_log`). Ajeno a Gate 0.
2. **`tests/rag.test.js` / `tests/suggestResponseKb.test.js`** — sensibles a si las claves de IA están presentes/ausentes (el `.env` autogenerado trae placeholders). Ambos pasan con el set de claves correcto.

Recomiendo trackearlos aparte; no bloquean Gate 0 pero ensucian `gate:local`.

### Hallazgos de CI en el PR #283
- **`Env drift` (era rojo) → arreglado.** Drift preexistente de la feature Calendar Phase D (commit `77d6bae`): `GOOGLE_CALENDAR_ENABLED` / `_TIME_ZONE` / `_DEFAULT_DURATION_MIN` se leen en `server/config.js` pero nunca se documentaron. Como Gate 0 exige que `Env drift` sea un required check **verde** en `main`, los agregué a `.github/ALLOWED_ENV_DRIFT.txt` (commit `0aa3789`). `node scripts/check-env-drift.mjs` → `✅ No env drift`.
- **`Channels — automated pipeline (prod)` (rojo) → fuera de alcance, sin acción.** Falla porque `scripts/smoke-prod-api.mjs` smoke-testea la API de **producción**; depende del estado de prod/red, no del diff del PR. No es uno de los required checks propuestos para branch protection. Ajeno a Gate 0.

---

## Preguntas abiertas para Matias

1. **Branch protection (ítem 1):** ¿confirmás los 3 checks requeridos (`Validate Calculations`, `Lint Check`, `Env drift`)? Los jobs "main only" (`Smoke`, `Voice`) corren sólo en push a `main`, así que no sirven como required checks de PR. ¿Aplico yo los pasos manuales cuando tenga el "go" y un token admin, o lo hacés vos por UI?
2. **Orden de activación en prod:** la secuencia segura es **(a)** provisionar `WHATSAPP_APP_SECRET` + `WEBHOOK_VERIFY_TOKEN` en Secret Manager → **(b)** redeploy. Si se redeploya el código fail-closed **antes** de tener los secrets, los webhooks ML/WhatsApp quedan rechazando hasta que existan. ¿Coordinamos esa ventana?
3. **Rotación de `API_AUTH_TOKEN`:** ¿la disparo (genero valor, `provision-secrets.sh`, redeploy) cuando des el "go", o ya está cubierta y sólo querés el test?
4. **Fallos preexistentes:** ¿abro un issue/ítem aparte para los 2 subtests RBAC de identity y el ruido de claves IA en los tests?

---

## Usage aproximado consumido (ADR R4)

Sesión Gate 0 sobre suscripción Claude (modo **B.1**): exploración del codebase (3 agentes Explore en paralelo), ~15 lecturas/ediciones de archivos, 1 `npm install`, varias corridas de tests. Estimado: **orden de ~1 sesión de trabajo de agente** (una tarde), dentro del presupuesto B.1. No se tocó la API de tokens (B.2). Sin disparador de migración B.1→B.2.

---

Gate 0 listo para tu aprobación. Fase 0 NO arrancada.
