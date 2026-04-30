# Plan Autónomo de Desarrollo — 2026-04-25

**Estado base:** score 85/100 · v3.1.5 · Cloud Run rev-00210 · gates cm-0/1/2 DONE  
**Objetivo:** subir score a 90/100 y estabilizar el pipeline ml-auto en prod con mínima fricción humana  
**Filosofía:** Fix → Deploy → Fix → Deploy. Una mejora live antes de la siguiente.  
**Gate antes de todo commit:** `npm run gate:local`  
**Gate antes de deploy Cloud Run:** `npm run gate:local:full`

---

## Fase 0 — Cleanup y baseline (ejecutar primero, sin deploy)

### 0a. Cerrar dev-trace pendiente

**Archivos:** `docs/dev-trace/AUTOTRACE-*.md`, `docs/dev-trace/commits/index.json`, `.accessible-base/kb.json`

```bash
npm run gate:local
git add docs/dev-trace/ .accessible-base/kb.json
git commit -m "chore(dev-trace): sync autotrace + worklog [SKIP_AUTOTRACE]"
git push
```

**Criterio de éxito:** `git status --short` sin archivos dev-trace unstaged.

---

### 0b. Gitignore server/.ml-automode.json

**Archivo:** `.gitignore`  
**Acción:** agregar línea `server/.ml-automode.json` — es estado runtime, no código fuente.

```bash
echo "server/.ml-automode.json" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore ml-automode runtime state"
git push
```

**Criterio de éxito:** `git status --short` no muestra `server/.ml-automode.json`.

---

### 0c. Verificar baseline prod

```bash
npm run smoke:prod
curl https://panelin-calc-q74zutv7dq-uc.a.run.app/api/ml/auto-mode
```

**Criterio de éxito:**
- `smoke:prod` → todos los checks ✅  
- `/api/ml/auto-mode` responde JSON con `{ fullAuto, crmPull, mlPull, autoSync, aiGen }` (los toggles de AUTOMATISMOS)  
- Si el endpoint da 404 → ml-auto pipeline no está en Cloud Run → ir a Fase 1b antes de continuar

**Agente:** `bmc-deployment`

---

## Fase 1 — Validar ml-auto pipeline en producción

### 1a. Smoke tests ml-auto endpoints (si Fase 0c OK)

El commit `e04fcce` ya existe en main con script de smoke para `/api/ml/auto-mode`.

```bash
npm run smoke:ml-auto    # si existe en package.json
# o directamente:
node scripts/smoke-ml-auto.js
```

**Archivos afectados:** `scripts/smoke-ml-auto.js` (ya commiteado en e04fcce)

**Criterio de éxito:** todos los checks del smoke pasan — GET/POST `/api/ml/auto-mode` retorna shapes correctas.

---

### 1b. Deploy Cloud Run si 0c falla (ml-auto en 404)

Solo ejecutar si Fase 0c encontró que `/api/ml/auto-mode` da 404 en Cloud Run.

```bash
npm run gate:local:full           # lint + test + build
bash scripts/deploy-cloud-run.sh  # push nueva revisión
# Esperar ~3 min, luego:
npm run smoke:prod
curl https://panelin-calc-q74zutv7dq-uc.a.run.app/api/ml/auto-mode
```

**Criterio de éxito:** `/health` → `hasSheets: true, hasTokens: true` · `/api/ml/auto-mode` → 200 con payload de toggles.

**Agente:** `bmc-deployment`

---

### 1c. QA manual AUTOMATISMOS cockpit en prod

En `https://calculadora-bmc.vercel.app/hub/ml`:

1. Abrir panel AUTOMATISMOS
2. Activar switch ML-AUTO-PULL → verificar que el servidor confirma estado (badge WEBHOOK ML)
3. Activar AI-RESPONSE-AUTO-GEN → generar respuesta de prueba
4. Activar "100% AUTÓNOMO" (cover switch, 2 clics) → confirmar que el pipeline full-loop arranca
5. Presionar EJECT X → confirmar que todos los intervalos se detienen

**Criterio de éxito:** cada switch actualiza el estado en `/api/ml/auto-mode` sin error 500. EJECT mata todo sin errores de consola.

**Agente:** `bmc-panelin-chat` (para depurar si hay errores de UI) / `bmc-deployment` (para errores de API)

---

## Fase 2 — ML revenue loop operativo

**Contexto:** no es desarrollo de código sino validación del ciclo completo. BMC tiene 41 publicaciones activas; cada pregunta ML sin responder es revenue perdido.

### 2a. Responder preguntas UNANSWERED

```bash
npm run ml:pending-workup    # ver cola de preguntas sin responder
```

**Secuencia operativa:**
1. Revisar preguntas en `/hub/ml` → columna UNANSWERED
2. Para cada pregunta: obtener precio desde MATRIZ (no inventar — validar con `curl .../api/crm/matriz-precio`)
3. Generar respuesta con AI-RESPONSE-AUTO-GEN o redactar manualmente
4. Aprobar en UI antes de enviar (`POST /api/crm/cockpit/send-approved`)
5. Verificar en ML que la respuesta llegó

**Criterio de éxito:** cola UNANSWERED vacía · respuestas visibles en ML para el comprador.

**Agente:** `bmc-panelin-chat` (para sugerencias de texto) · acción humana para aprobar y enviar.

---

### 2b. Validar precio MATRIZ vs respuesta enviada

Para cada respuesta enviada:

```bash
curl -X POST https://panelin-calc-q74zutv7dq-uc.a.run.app/api/crm/matriz-precio \
  -H "Content-Type: application/json" \
  -d '{"perfil":"...", "largo":...}'
```

Confirmar que el precio en la respuesta ML ≤ precio MATRIZ (umbral = 0).

**Criterio de éxito:** no hay respuestas enviadas con precio inventado o superior al umbral MATRIZ.

---

## Fase 3 — Mejoras de calidad (score gaps)

### 3a. Fiscal / Compliance — subir de 6/10 a 8/10

**Objetivo:** trazar BPS/IRAE en el dashboard operativo y generar reporte fiscal exportable.

**Archivos clave:**
- `server/routes/bmcDashboard.js` — agregar endpoint `/api/fiscal/bps-irae`
- `src/components/` — módulo fiscal visual (tabla IRAE estimado, BPS mensual, IVA retenido)
- Referencia: `server/routes/bmcDashboard.js` ya tiene `/kpi-report` con `irae_prevision`

**Spec mínima:**
1. Endpoint `GET /api/fiscal/bps-irae` que retorna: `{ mes, irae_estimado, bps_empleador, bps_dependiente, iva_ventas, iva_compras, resultado_neto }`
2. UI card en `/hub/admin` mostrando esos valores con semáforo (verde/amarillo/rojo vs umbrales)
3. Exportar como CSV

**Secuencia:**
```bash
# 1. Implementar endpoint
# 2. npm run gate:local
# 3. git commit -m "feat(fiscal): BPS/IRAE tracking endpoint"
# 4. npm run gate:local:full
# 5. bash scripts/deploy-cloud-run.sh
# 6. Verificar en /hub/admin
```

**Criterio de éxito:** `/api/fiscal/bps-irae` → 200 con datos de Sheets · UI card visible con valores reales · `npm run smoke:prod` sigue verde.

**Agente:** `bmc-fiscal`

---

### 3b. AI Chat — subir de 7/10 a 9/10

**Objetivo:** más entradas KB + ciclo de corrección de respuestas erróneas.

**Archivos clave:**
- `.accessible-base/kb.json` — fuente KB para el chat
- `server/lib/trainingKb.js` (o equivalente) — entradas de training
- `src/components/PanelinChatPanel.jsx` — UI del chat

**Spec:**
1. Agregar 5 entradas KB nuevas en áreas con baja cobertura: garantías, dimensiones técnicas, instalación en zonas húmedas, mantenimiento, comparación con lana mineral
2. Wired el botón "Correct" (Good/Correct por mensaje) para que grabe correcciones en training-kb
3. Endpoint `POST /api/agent/corrections` — recibe `{ messageId, correctedText }` y lo agrega a KB

**Secuencia:**
```bash
# 1. Agregar entradas KB en .accessible-base/kb.json (o tabla training-kb en Sheets)
# 2. Implementar endpoint /api/agent/corrections si no existe
# 3. npm run gate:local
# 4. git commit -m "feat(chat): kb-009..013 + corrections endpoint"
# 5. git push (Vercel auto-deploy)
# 6. QA en /hub/chat: probar preguntas de garantía, dimensiones, húmedas
```

**Criterio de éxito:** chat responde correctamente a 5 preguntas nuevas sin inventar datos · botón Correct guarda en KB.

**Agente:** `bmc-panelin-chat`

---

### 3c. WhatsApp — verificación periódica cm-0

**No es código nuevo.** Checklist operativo mensual:

1. Enviar WA real al número de BMC con consulta de precio
2. Verificar que aparece nueva fila en CRM_Operativo (Google Sheets)
3. Verificar que el bot responde automáticamente si AUTO-WA está activo
4. Documentar evidencia en PROJECT-STATE.md

**Criterio de éxito:** fila CRM nueva visible · respuesta WA entregada al comprador.

---

## Fase 4 — Items con bloqueantes

### 4a. ⚠️ BLOQUEADO — Wizard toggle largo global/local (Item 9)

**Situación:** no hay spec. Cada zona ya tiene su propio `largo` independiente (`techo.zonas[].largo`). No implementar hasta que el usuario confirme si necesita un "sync global".

**Acción:** preguntar al usuario: *"¿El comportamiento actual (cada zona con largo propio) es suficiente, o querés un toggle que sincronice todas las zonas al mismo largo?"*

**Archivo potencial:** `src/components/PanelinCalculadoraV3.jsx`

---

### 4b. 🔵 LaunchAgent local stack (opcional)

Solo si el usuario trabaja desde la misma máquina y quiere levantar el stack automáticamente al login.

```bash
npm run local:stack:launchd:install
curl localhost:3001/health
```

---

## Checklist de deploy limpio (antes de cada Cloud Run push)

```
[ ] npm run gate:local:full  → 0 errores, 0 warnings nuevos
[ ] npm run smoke:prod       → todos los checks ✅
[ ] /health → hasSheets: true, hasTokens: true
[ ] git tag vX.Y.Z (si hay bump de semver)
[ ] Documentar en PROJECT-STATE.md
[ ] npm run kb:build         → actualizar .accessible-base/kb.json con nueva rev
```

---

## Orden de ejecución sugerido

```
0a → 0b → 0c → (si 404 en 0c: 1b) → 1a → 1c → 2a → 2b → 3a → 3b → 3c
```

Bloquear 4a hasta respuesta del usuario sobre spec. Ignorar 4b por ahora.

---

## Score proyectado al completar

| Fase | Áreas mejoradas | Score esperado |
|------|----------------|---------------|
| Baseline hoy | — | 85/100 |
| Fase 0+1 | Deploy/CI, AUTOMATISMOS validado | 86/100 |
| Fase 2 | ML revenue loop activo | 87/100 |
| Fase 3a | Fiscal 6→8 | 89/100 |
| Fase 3b | AI Chat 7→9 | 91/100 |

**Target: 90/100** — alcanzable con Fases 0-3.

---

*Generado 2026-04-25 | Próxima revisión tras completar Fase 2*  
*Fuente: kb.json v2.0.0 · ROADMAP.md · git log -10*
