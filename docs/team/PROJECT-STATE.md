# Project State — BMC/Panelin

**Última actualización:** 2026-06-12 (Consolidación definitiva)

**SOURCE OF TRUTH:** Branch `final/ultimate-consolidation-20260612`. 
Esta rama consolida TODO el trabajo disperso de los últimos días (ISOFRIG, Wolf Debug v2, Auth Hardening, Accesorios, Catalog Diff CI, Panelin Voice). **Usar esta rama para cualquier PR a main.**

---

## Cambios recientes

**2026-06-12 (CONSOLIDACIÓN DEFINITIVA — Reseteo de sanidad de ramas):** `SHIPPED / VERIFICADO`. Fusión exitosa de 6+ fuentes divergentes en un único estado coherente. 
- **Integrado:** `claude/isofrig-family-catalog-3gd2yn` (Familia ISOFRIG + au 1.10).
- **Integrado:** `fix/review-5ae44e21-...` (Wolf Debug v2 funcional + renders mascot).
- **Integrado:** `cursor/critical-bug-investigation-ff84` (Auth hardening de plataforma).
- **Integrado:** `claude/wolf-0003-accesorios-lyp1r8` (Accesorios perimétricos y SKUs corregidos).
- **Integrado:** `claude/wolf-0004-catalog-diff-ci-t35qqr` (Herramienta de diff determinístico y workflow baseline-aware).
- **Integrado:** `final/wolf-debug-voice-hardening-20260611` (Panelin Voice + Secrets automation).
- **Fixes locales:** Resueltos conflictos en `constants.js` (unificando precios y ficha técnica) y `PROJECT-STATE.md`.
- **Calidad:** `npm run gate:local` **VERDE** (0 errores, lint limpio de regresiones, 399 tests core + tests API).
- **Delivery:** Rama `final/ultimate-consolidation-20260612` pusheada y lista para merge a `main`.

**2026-06-12 (WOLF-2026-0001 — carga familia ISOFRIG + KB de productos):** `en eval (PR #332, draft)`. Familia `ISOFRIG_PIR` cargada en `constants.js`: 7 espesores 40–180 (`web` ex-IVA textual Matriz BROMYROS; fila 200 clonada excluida), au **1.10** validado contra ficha oficial Kingspan (legacy traía 1.14 copiado de ISOPANEL), núcleo PIR, solo Blanco sanitario; perfil U ISOFRIG 80/100/150 (PU* compartidos; U 40/60/120/180 TODO-blocked sin precio); visible en `camara_frig` y `presupuesto_libre`. Golden case **GC-0001 verde** (`evals/golden-cases/`), GC-0002 sigue verde; `gate:local` ok (1 fallo `test:api` pre-existente en main, ambiental). TODO-blocked: `venta`/`costo` por espesor desde Matriz. Extra: base de conocimiento de productos `docs/product-catalog/` (generador + JSON + MD, 97 ítems del Shopify real, con desfasaje Shopify↔Matriz documentado). Ledger v0.7.

**2026-06-12 (Secrets hardening — automated pipeline + auto-generated --set-secrets from HIGH_SENS_KEYS):** `implementado + automated run ready`. Full end-to-end automation for secrets/GSM changes:
- `scripts/provision-secrets.sh --print-mounts` (generator for CI).
- `.github/workflows/deploy-calc-api.yml` now dynamically computes --set-secrets (no more manual long list or key wipes on deploy).
- New `scripts/secrets-provision-verify.sh` (doppler-first, 4-phase, consumers table).
- New `scripts/secrets-automated-pipeline.mjs` (`npm run secrets:automated -- --write`) — drift + gates + verify + pre-deploy + smoke (modeled on channels:automated).
- `npm run secrets:automated` + package.json entry + pre-deploy enhancement + deploy skill update.
- Verified: drift=0, verify script OK (dry), smoke passes, generator auto-includes future keys.
- RUN-LOG at `.runtime/secrets-hardening-prod-run.log`.
- Use `doppler run -- npm run secrets:automated` for real runs. See approved plan and `SECRETS-STRATEGY.md`.
Next: merge feature to main, push (triggers deploy-calc-api), verify live revision mounts + full smoke against panelin-calc.
=======
**2026-06-12 (Critical bug automation — Panelin platform auth + merge-artifact cleanup):** `fix listo en rama cursor/critical-bug-investigation-ff84`. Hallazgo crítico en PR #331: el nuevo router `server/routes/panelin.js` quedaba montado bajo `/api/panelin/*` sin auth, permitiendo a un caller anónimo con la API pública y DB configurada leer productos/stock/facturas y mutar costos, precios recalculados, movimientos de stock e invoices. Se protegió todo el router con el guard canónico `requireAuth` (Bearer / `X-Api-Key` vía `API_AUTH_TOKEN`) y se agregó `tests/panelinPlatformAuth.test.js` al gate API para probar rechazo anónimo antes de DB + caller autenticado gated por disponibilidad DB. En la misma pasada se resolvieron conflict markers en `DetailDrawer.jsx` y `inspect-docker-context.cjs`, más errores JSX de `AdminCotizacionesModule.jsx` (`showToast` fuera de scope, prop duplicada, import muerto). Validación: test nuevo OK, lint sin errores, `npm test` OK dentro de `gate:local:full`, build prod OK; `test:api` queda bloqueado por fallo preexistente en `tests/suggestResponseKb.test.js` (details array vacío en caso agentCore bogus key), no causado por este fix.
>>>>>>> origin/cursor/critical-bug-investigation-ff84

**2026-06-11 (Wolf Debug — fully functional production triage & bug hunting module with custom wolf mascot):** `implementado`. Nuevo módulo dedicado `/hub/wolf-debug` (RequireGrant admin). 
- Tres renders oficiales del lobo como estados visuales: hero (Image #1), review/search (Image #2), hunt/capture (Image #3).
- Totalmente funcional: health probes reales (/health + wolfboard data), sweeps, lista compacta de bugs desde /api/bugs, apertura del BugReportModal vía bus con contexto, "Modo Caza", comandos de producción copiables (gate, smoke, etc.).
- Fallback robusto y bonito si los PNGs aún no están en la carpeta (permite deploy inmediato).
- Actualizado WolfboardHub con card prominente "🐺 Wolf Debug".
- Spec limpio redactado en `docs/team/wolf-debug-system.md`.
- Lint específico limpio, build de producción exitoso. 
Assets: colocar los tres renders como `wolf-hero.png`, `wolf-review.png`, `wolf-hunt.png` en `public/images/wolf-debug/`.
Pendiente operador: subir imágenes + gate:local:full + smoke:prod + deploy (Vercel + Cloud Run si aplica).

**2026-06-11 (Panelin Voice — first-class learning channel + auth + browser fallback):** `implementado + deployado a producción`. Ejecución completa del goal `goal-prompt-panelin-voice-agent-learning-architecture.md` vía skill dedicada + full deploy flow (gate:local:full, smoke:prod, pre-deploy, scripts/deploy-*.sh). 

**Deploys:**
- Frontend Vercel prod: https://calculadora-bmc.vercel.app (authHeader desde bmcAuth.accessToken, useChat.appendMessage con source:"panelin_voice", bridging en PanelinChatPanel/PanelinVoicePanel, improved Safari fallback + dictado promotion, VoiceTab nota de integración, etc.).
- Backend Cloud Run (panelin-calc): https://panelin-calc-q74zutv7dq-uc.a.run.app (rev panelin-calc-00454-wmg) — incluye requireAuth en /agent/voice/action + build SUCCESS via Cloud Build 09e693ee-....
- Smoke:prod verde post-deploy. Gates limpios (0 errores nuevos).

**Listo para real testing:** Usuarios autenticados (login Google) en Chrome/Edge pueden abrir Panelin chat, activar voz, hablar cotizaciones (acciones live), ver transcripciones inyectadas al historial compartido y eventualmente extraídas a trainingKB con source panelin_voice. Safari: mensaje útil + fallback a dictado. Sin 401s ni prompt crudo de token en flujos normales.

Ver `.runtime/REAL-VOICE-TESTING-IN-PRODUCTION.md` para pasos exactos. 
- `useChat.appendMessage` + wiring en `PanelinChatPanel`/`PanelinVoicePanel`: transcripciones de voz (user + assistant `audio_transcript`) se appendean al historial compartido con `source: "panelin_voice"` + `convId`. Fluyen a `extractLearnablePairs` (agentChat.js) → trainingKB / RAG usando los mismos criterios estrictos BMC.
- Auth: `authHeader` derivado de `bmcAuth.accessToken` (Bearer) se propaga explícitamente a todos los mounts de `PanelinChatPanel` (sidebar/floating/detached). 401s eliminados para usuarios logueados. Prompt crudo "Pegá API_AUTH_TOKEN" ahora guarded (solo anon + dev explícito).
- `/api/agent/voice/action` ahora requiere `requireAuth` (consistencia).
- Browser: banner mejorado en Safari (explicación clara "por qué Chrome/Edge" + promoción fuerte del dictado + TTS existente como fallback first-class).
- Admin: VoiceTab incluye nota de integración de aprendizaje (contribuciones con source voice ahora visibles en colas de training).
- Artefacto de verificación: `.runtime/voice-agent-learning-integration.md`.
- Gates: lint (solo warnings pre-existentes), `npm test` verde completo. Sin regresión en chat texto, TTS, dictado o calculadora.
- Hecho confirmado durante la corrida: el punto de integración canónico era `useChat` + post-procesado en agentChat.js (ya soportaba source/convId). Voice era transporte aislado en estado local — ahora es peer channel.
Ver skill `.cursor/skills/panelin-voice-agent-learning-architecture/SKILL.md` y el goal prompt para detalles completos + success criteria.

**2026-06-11 (WOLF-2026-0005 — provider IA del plan interpreter: VERIFICADO RESUELTO, sin acción):** `RESUELTO / verificación en vivo, sin cambio de infra`. Run de ops config-only para "Sin proveedor IA configurado" en el intérprete de planos (Cloud Run `panelin-calc`, proyecto `chatbot-bmc-live`). **Hallazgo:** el gap de runtime-config ya no existe — `ANTHROPIC_API_KEY` está montada y con billing activo en prod. Evidencia en vivo: `POST /api/crm/suggest-response` → `{"ok":true,"provider":"claude","model":"claude-opus-4-7"}`; `POST /api/plan/interpret` (multipart `file`) → **HTTP 200** con extracción real del modelo (no el 503 `Sin proveedor IA configurado` — nota: ese endpoint lanza 503 sin campo `code`; el `code: "IA_NOT_CONFIGURED"` es de `/api/crm/suggest-response`). Esto cierra la cadena de la entrada 2026-06-10: las keys habían sido remontadas (rev `00449-ncb`) pero daban `All providers failed` por crédito bajo de Anthropic; el billing ya fue recargado y el proveedor responde. **Durabilidad confirmada:** [`deploy-calc-api.yml`](../../.github/workflows/deploy-calc-api.yml) línea 175 ya incluye `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`GROK_API_KEY`/`GEMINI_API_KEY` en `--set-secrets`, así que el próximo deploy no vuelve a borrarlas (riesgo de regresión cerrado). **Corrección de doc:** el endpoint real es `POST /api/plan/interpret` (mount `/api` + ruta `/plan/interpret`, `server/index.js:999`), **no** `/api/planInterpret` — ese path da 404; además requiere subir un archivo multipart (`file`), un POST sin body da 400 antes de llegar al chequeo de proveedor. Sin cambios de código ni de secrets (rotar la key viva sería riesgo innecesario). Ledger: **WOLF-0005 → RESUELTO, GC-0005 verde**. Pendientes Gate-0 (revocar token GitHub fine-grained de Gate 0 + provisionar webhook secrets vía `provision-secrets.sh` + redeploy) quedan como follow-up con shell autenticada (no ejecutables desde la sesión web sin `gcloud`/`doppler`).

**2026-06-10 (precios WOLF-2026-0004 — alta familia ISOFRIG PIR + perfiles cámara):** `mergeado a main / verificar precios pre-deploy`. Nueva familia de panel pared **ISOFRIG_PIR** (cámaras frigoríficas, 40–200mm) en [`constants.js`](../../src/data/constants.js) with `venta`/`web`/`costo`, más perfiles nuevos (goteros 100mm, `GLDCAM` cámara 100–250, `GSDECAM100`) y mapeos SKU→path en [`matrizPreciosMapping.js`](../../src/data/matrizPreciosMapping.js). Wire de `ISOFRIG_PIR` en escenarios `techo_fachada` + `camara_frig`. Tooling: `matriz:sync-auto` ([`scripts/matriz-sync-automation.mjs`](../../scripts/matriz-sync-automation.mjs)) wrapper CI/cron con umbrales de seguridad. `gate:local` verde (lint + 350+ tests + test:api). **⚠️ Verificar pre-deploy:** (1) ISOFRIG `200mm` venta **90.99** < `180mm` **91.32** (posible quirk de transcripción de Matriz, mismo `costo` 68.00); (2) `GLDCAMDC` sigue mapeando a `ISODEC._all`, path ahora desglosado por thickness 100–250 en constants — correr `npm run matriz:reconcile` antes de confiar. Mergeado a `main` vía branch `feat/isofrig-pir-pricing`; **push/deploy pendiente de aprobación operador**.

**2026-06-10 (live-fix — IA keys wiped by Cloud Run deploy):** `parcial / bloqueado operador (billing keys)`. Tras deploy manual PR3, `suggest-response` devolvía `IA_NOT_CONFIGURED` porque `deploy-calc-api.yml` `--set-secrets` omitía las 4 keys IA and cada deploy las borraba. **Fix código:** añadir `ANTHROPIC/OPENAI/GROK/GEMINI_API_KEY` al workflow (PR pendiente). **Fix infra:** remount GSM + sync Doppler→GSM → revisión `panelin-calc-00449-ncb`; ya no `IA_NOT_CONFIGURED` pero `All providers failed`: Anthropic crédito bajo, OpenAI 429 quota, Grok key inválida, Gemini API no habilitada en GCP. **Operador:** recargar Anthropic y/o OpenAI billing y/o rotar `GROK_API_KEY` y/o habilitar Generative Language API.

**2026-06-10 (S5 Phase B PR3 — remove cockpit-token browser endpoint):** `shipped`. Elimina `GET /api/crm/cockpit-token` y `server/lib/cockpitTokenOrigin.js` (vector de fuga del token estático al browser). Limpieza en `operatorApiClient.js` (sin fetch deprecated), test offline `cockpitTokenRemoved.test.js` (404), script `scripts/rotate-api-auth-token.mjs` (dry-run por defecto). Docs: `CRM-OPERATIVO-COCKPIT.md` §4 auth dual; retirado `COCKPIT_TOKEN_ALLOWED_ORIGINS` de `.env.example` y `run_ml_cloud_run_setup.sh`. Sigue la secuencia S5: PR1 dual auth → PR2 hub JWT → **PR3 endpoint muerto**. **Pendiente operador post-deploy:** rotar `API_AUTH_TOKEN` (`node scripts/rotate-api-auth-token.mjs --apply` con aprobación explícita) y actualizar consumidores (GPT/MCP/CI).
