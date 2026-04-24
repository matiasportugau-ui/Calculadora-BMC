# Runbook — Claude (terminal) / Panelin interno + orquestador en app

Brief ejecutable para **Claude Code** u otro agente en terminal. Objetivo: continuar la implementación del **asistente interno** (orquestador en la app), con **RBAC por función**, **aprobación humana por defecto**, **automatización opt-in** (ongoing / periodo / horario), **misma planilla** para cotizaciones, **ML en fase 2**. Custom GPT queda **standby**.

**Leer antes:** [`AGENTS.md`](../../AGENTS.md), [`docs/AGENT-UI-VS-API.md`](../AGENT-UI-VS-API.md), [`docs/team/HUMAN-GATES-ONE-BY-ONE.md`](HUMAN-GATES-ONE-BY-ONE.md) si aparece bloqueo cm-0/1/2.

---

## 1) Invocación rápida en terminal (Claude Code)

Desde la raíz del repo (`Calculadora-BMC`):

```bash
cd "/Users/matias/Panelin calc loca/Calculadora-BMC"

# Opción A — adjuntar este runbook como contexto explícito
claude --dangerously-skip-permissions \
  "Seguí estrictamente docs/team/CLAUDE-PANELIN-ORQUESTADOR-RUNBOOK.md sección AUTOPILOT. \
   Leé AGENTS.md. Implementá la Fase en curso; al final: npm run gate:local y, si tocó API, \
   npm run start:api en background y npm run test:contracts. Escribí un resumen en stdout."

# Opción B — sin skip-permissions (recomendado si querés confirmar cada herramienta)
claude \
  "Misma instrucción que Opción A; pedí confirmación antes de git push o deploy."
```

Ajustá el binario `claude` si tu instalación usa otro comando (`claude-code`, etc.).

---

## 2) Mapa técnico obligatorio (no inventar rutas)

| Área | Archivos / endpoints |
|------|----------------------|
| Índice agente | `GET /capabilities` — `server/agentCapabilitiesManifest.js`, snapshot `docs/api/AGENT-CAPABILITIES.json` (`npm run capabilities:snapshot`) |
| Calculadora HTTP | `server/gptActions.js`, `server/routes/calc.js`, `docs/openapi-calc.yaml` |
| Chat Panelin (UI) | `server/routes/agentChat.js`, `server/lib/chatPrompts.js` |
| Dashboard / Sheets | `server/routes/bmcDashboard.js` — rutas en `DASHBOARD_ROUTES` del manifiesto |
| Panelin interno (RBAC + invoke) | `GET /api/internal/panelin/whoami`, `/tools`, `/policies`, **`POST /invoke`** — `server/routes/panelinInternal.js`, `server/lib/panelinInternalRbac.js`, `server/lib/panelinInternalInvoke.js`; doc `docs/team/PANELIN-INTERNAL-RBAC.md` |
| Contratos | `scripts/validate-api-contracts.js` → `npm run test:contracts` (API en marcha) |

---

## 3) AUTOPILOT — Bucle de trabajo (seguir en orden)

**Regla:** no saltar fases; no meter ML como bloqueante de Fase 1.

### Paso 0 — Reconocimiento (solo lectura)

1. Leer `server/agentCapabilitiesManifest.js` y comparar con rutas reales en `bmcDashboard.js` y `calc.js` (drift).
2. Anotar en el resumen del turno: **qué endpoints existen** para cotizaciones (`GET/POST /api/cotizaciones`) y auth actual (Bearer `API_AUTH_TOKEN`, cockpit, etc.).

### Fase 0 — RBAC y seguridad (fundación)

**Objetivo:** una función central del estilo `assertPermission(actor, method, path)` o equivalente; tests que esperen **403** para rol sin permiso.

**Entregables mínimos:**

- Matriz roles × rutas (documento corto en PR o comentario).
- Sin triple sistema de auth nuevo: **reutilizar** el patrón del repo.

**Hecho cuando:** tests de permiso pasan; rutas sensibles no quedan abiertas “por olvido”.

### Fase 1 — Tool layer + orquestador en app

**Objetivo:** el asistente interno **invoca HTTP** (`/calc/*`, `/api/*`) vía capa de tools, no solo texto y `ACTION_JSON`.

**Entregables mínimos:**

- Catálogo de tools: nombre estable, método, path, riesgo (`low`/`medium`/`high`), default `approval_required`.
- Flujo feliz: lectura de cotizaciones permitidas → `POST /calc/cotizar` (o flujo documentado) → registro en planilla **tras** cola si default.

**Hecho cuando:** demo local documentada (pasos); `npm run gate:local` verde; si hay cambios de contrato, `npm run test:contracts` verde.

### Fase 2 (producto) — Cola de aprobación + políticas

**Objetivo:** default **aprobación humana**; opt-in **auto** con:

- ongoing (flag),
- periodo (`valid_from` / `valid_until`),
- horario (timezone **America/Montevideo**).

**Entregables mínimos:**

- Modelo `ActionRequest` con `idempotency_key` para escrituras a Sheets (evitar duplicados en retry).
- Estados: `pending` → `approved` | `rejected` → ejecución.

**Hecho cuando:** misma acción respeta política; auditoría registra decisión y resultado.

### Fase 3 — ML / Mercado Libre

**Solo después** de cerrar Fase 1 + cola estable. Reutilizar RBAC y cola; no duplicar lógica.

---

## 4) Toma de decisiones (si hay ambigüedad)

1. **¿Afecta datos de cliente o dinero?** → escritura va a **cola** salvo política explícita `auto`.
2. **¿Hay dos fuentes de verdad?** → preferir **Sheets vía `/api/cotizaciones`** para registro; no confundir con listados efímeros de sesión en `/calc/*` (ver `AGENT-UI-VS-API.md`).
3. **¿Drift manifiesto vs código?** → corregir `agentCapabilitiesManifest.js` y correr `npm run capabilities:snapshot`.
4. **¿Bloqueo OAuth / Meta / cm-*?** → parar y seguir `HUMAN-GATES-ONE-BY-ONE.md`; no “inventar” credenciales.
5. **¿Cambio grande no pedido?** → no hacer refactor masivo; PRs/tareas pequeñas.

**Decisión pendiente explícita (v1):** origen de identidad/roles (Google SSO vs tabla vs env). Si el dueño no definió: implementar la opción de **menor fricción** compatible con el deploy actual y documentar trade-offs en el PR.

---

## 5) Comandos de verificación (obligatorios antes de cerrar turno)

```bash
npm run lint
npm run gate:local
# Si tocaste rutas /capabilities o contratos:
npm run start:api   # en otra terminal o background
npm run test:contracts
```

Deploy Cloud Run / Vercel: solo si el alcance del ticket lo pide; seguir skill deploy del repo en `AGENTS.md`.

---

## 6) Formato del resumen al humano (cada corrida autopilot)

Escribir al final:

- **Fase completada / en progreso**
- **Archivos tocados** (lista)
- **Cómo probar** (3–6 bullets)
- **Riesgos / follow-ups**
- **¿Drift en capabilities?** (sí/no + qué hiciste)

---

## 7) Prompt compacto (copiar solo el párrafo)

```
Sos el agente de implementación Panelin interno. Objetivo: orquestador en la app con RBAC,
aprobación por defecto, automatización opt-in (ongoing/periodo/horario Montevideo), misma planilla
cotizaciones, ML fase 2, GPT standby. Seguí docs/team/CLAUDE-PANELIN-ORQUESTADOR-RUNBOOK.md AUTOPILOT.
Leé AGENTS.md. Fase 0→1→2 en orden. Al cerrar: npm run gate:local y test:contracts si aplica.
No refactors masivos fuera de alcance. Documentá origen de roles si no está definido (elige v1 mínima).
```

---

*Creado para ejecución por agente en terminal; mantener alineado con decisiones de producto en `PROJECT-STATE.md`.*
