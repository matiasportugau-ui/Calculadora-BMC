# Project Health Snapshot — Calculadora BMC

**Fecha:** 2026-07-19  
**Método:** `bmc-holistic-project-health` + sensores live (sin deploy, sin Invoque full team)  
**Repo:** `/Users/matias/calculadora-bmc`  
**Branch local:** `feat/panelin-build-max-b01-done` @ `297d738f`  
**origin/main:** `f302d26b`  
**Prod UI:** https://calculadora-bmc.vercel.app  
**Prod API:** https://panelin-calc-q74zutv7dq-uc.a.run.app  
**Canvas:** `~/.cursor/projects/Users-matias-calculadora-bmc/canvases/bmc-holistic-health-2026-07-19.canvas.tsx`

**Readiness global (media de 12 áreas): 82%**

---

## Executive summary

Producción está **operativa en el camino crítico de cotización**: `/health` ok con Sheets+ML tokens, MATRIZ CSV 200, `POST /calc/cotizar` devolvió BOM/totales reales (ISODEC EPS 100mm → **USD 3,046.77**), SPA Vercel 200, smoke **9/9** con Doppler `bmc-backend/prd` (IA via **gemini**). Harness Control System sigue expert-complete (**98.2/100**, DoD 12/12).

El bloqueo inmediato de ingeniería es **`gate:local` rojo**: `tests/toolStats.test.js` exige 42 tools y `AGENT_TOOLS.length === 48`. En paralelo, `test:api` falla por **secrets drift** (`FINANZAS_MODULE_PASSWORD` en `--set-secrets` pero no en el manifest). Asistentes `active=[canales,ml,panelin]` todos **degraded→gemini**; issue **#610** OPEN (Claude credits / Grok key). Human gates **cm-0/1/2** están `done` en el master JSON — no se inventa éxito nuevo; IG/FB y email Omni siguen parciales por diseño/human.

As-built SDD ya existe en `docs/sdd/calculadora-bmc/` (COMPAT PASS). **No** hace falta re-correr `sdd-reverse-engineer`; falta `sdd-quality-auditor` (`audit/` vacío).

---

## Health checks (esta corrida)

| Command / probe | Result | Notes |
|-----------------|--------|-------|
| `curl …/health` | **pass** | `ok:true`, `hasSheets:true`, `hasTokens:true`, tabs CRM presentes |
| `curl …/capabilities` | **pass** | `public_base_url` alineada; build sha `df4e9c93` (ancestor de main) |
| `POST /calc/cotizar` | **pass** | body con `familia=ISODEC_EPS`, `espesor=100`, `zonas[]` |
| `GET /api/actualizar-precios-calculadora` | **pass** | HTTP 200, ~15.5 KB |
| `npm run smoke:prod` (shell sin secretos) | **fail** | `API_AUTH_TOKEN` UNSET → suggest-response 401 |
| `doppler run … npm run smoke:prod` | **pass** | **9/9**, suggest-response IA **gemini** |
| `GET /api/assistants/status?deep=1` (+ token) | **pass** | active `canales;ml;panelin`; all degraded→gemini; `email` down |
| `npm run gate:local` | **fail** | lint warnings only; **toolStats** 42≠48 |
| `npm run test:api` | **fail** | `gate-secrets-drift`: UNDECLARED `FINANZAS_MODULE_PASSWORD` |
| `npm run harness:score` | **pass** | 98.2/100, DoD 12/12 |
| `node tests/validation.js` | **pass** | 441/441 |
| local `:3001` / `:5173` | **down** | `test:contracts` / `test:agent-golden` no ejecutables |
| Vercel SPA | **pass** | HTTP 200 |
| Transportista / TraKtiMe `/health` | **pass** | ambos 200 |
| Training KB match (anon) | **401** | “Unauthorized developer mode” — no evidencia de conteo KB esta corrida |

---

## Architecture map (12 áreas)

| Área | Estado | % | Evidencia | Riesgo | Next action |
|------|--------|--:|----------|--------|-------------|
| 1. Calculadora core | OK | 92 | Cotizar prod + validation 441/441 + catalogo 6 familias | Bajo | Mantener; no mutar precios sin negocio |
| 2. PDF / templates | OK | 88 | 14 layouts incl. `classic`; tests classic/pdf green | Medio (Chromium hist.) | Smoke PDF render prod si se toca `quotePdf` |
| 3. Auth / grants / MFA | OK | 85 | ML OAuth status; routes `/api/auth/*`; unlock 401 anon | Medio | UAT finanzas unlock con grant `banco` |
| 4. Hub / Wolfboard | Parcial | 78 | SPA 200; módulos documentados; local down | Medio | Levantar stack + smoke hub rutas |
| 5. API + contratos | Parcial | 72 | Health/capabilities/calc OK; gate/contracts rotos/skip | **Alto** | Fix toolStats + secrets drift; luego contracts |
| 6. Sheets / CRM / Finanzas | OK | 88 | Sheets diag OK; MATRIZ; `/finanzas` 200 | Medio | No tocar mapping sin Sheets specialist |
| 7. Panelin / RAG / KB | Parcial | 78 | panelin active; seam gemini; #610 | **Alto** (calidad IA) | Resolver #610 créditos/keys |
| 8. WA / ML / canales | Parcial | 75 | WA+ML smoke OK; IG/FB OFF; email #624 | Medio | Human: Meta pixel / email H1–H4 |
| 9. Transportista / TraKtiMe / log | OK | 85 | Health 200; fleteEngine + traktime tests | Bajo | — |
| 10. Deploy Vercel + Cloud Run | OK | 90 | SPA+API vivos; Vercel Production `f302d26` | Bajo | No deploy esta sesión |
| 11. Tests / gate / smoke / HCS | Parcial | 75 | HCS 98.2; smoke 9/9 doppler; gate FAIL | **Alto** | Cerrar P0 gate |
| 12. Docs / PROJECT-STATE / skills | Parcial | 82 | SDD COMPAT PASS; audit vacío; map 15→19 | Medio | `sdd-quality-auditor` |

---

## Top 10 gaps (impacto)

| # | Pri | Gap | Evidencia | Acción |
|---|-----|-----|-----------|--------|
| 1 | P0 | `gate:local` FAIL — toolStats 42 vs 48 | `tests/toolStats.test.js:103`; `AGENT_TOOLS.length=48` | Actualizar assert + revisar telemetría; re-correr gate |
| 2 | P0 | Secrets drift `FINANZAS_MODULE_PASSWORD` | `npm run test:api` → gate-secrets-drift | Declarar en manifest de secrets o alinear deploy |
| 3 | P1 | Seam solo Gemini (#610) | assistants status degraded; issue OPEN | Recargar créditos Claude / rotar GROK_API_KEY |
| 4 | P1 | Meta Pixel no configurado | PROJECT-STATE 2026-07-13 | Set `VITE_META_PIXEL_ID` en Vercel (humano) |
| 5 | P1 | Omni email Gap 1 (#624) | PROJECT-STATE OMNI | Human gates H1–H4 casillas |
| 6 | P1 | IG/FB Omni dormant | flags default OFF | Meta app review / tokens antes de ON |
| 7 | P1 | SDD system sin score | `docs/sdd/calculadora-bmc/audit/` vacío | `sdd-quality-auditor` |
| 8 | P2 | HARNESS-MAP drift (goldens 15→19, S-A-05 path) | HCS-AUDIT-2026-07-19 | Doc-only fix en map |
| 9 | P2 | Local stack down | curl :3001/:5173 fail | `workspace:autostart` / `doppler run -- npm run dev:full` |
| 10 | P2 | Finanzas UAT unlock pendiente | PROJECT-STATE | Login + password module en `/hub/finanzas` |

---

## Qué no tocar

- `ASSISTANTS_ACTIVE` / toggles de asistentes sin pedido explícito  
- Human gates cm-0/1/2 (ya `done`) — no re-marcar ni inventar  
- Precios / `constants.js` / MATRIZ sin aprobación de negocio  
- `npm audit fix --force`  
- Deploy / Invoque full team (fuera de scope de esta revisión)  
- `RoofPanelRealisticScene` shared `|| 15` (fix vive en wrapper)

---

## SDD kit routing

| Pregunta | Respuesta |
|----------|-----------|
| ¿Falta as-built? | **No** — `docs/sdd/calculadora-bmc/SDD.md` (2026-07-19, COMPAT PASS, recreation 33/33) |
| ¿Re-correr reverse-engineer? | **No** (salvo delta arquitectónico grande) |
| ¿Siguiente skill? | **`sdd-quality-auditor`** sobre ese SDD → `audit/SCORECARD.json` + `GAP-PLAN.md` |
| ¿Evolution-loop? | Solo después del GAP-PLAN del auditor |

---

## Prompt listo — development glory (gap #1)

```text
/development-glory

G0 Goal lock
- Path: ~/calculadora-bmc
- Mode: existing code (fix gate, not greenfield)
- Slug: calculadora-bmc-gate-toolstats (workstream; system SDD already at docs/sdd/calculadora-bmc/)
- Success metric: `npm run gate:local` exit 0 on this branch; AGENT_TOOLS count assertion matches reality; no deploy

G1 Document
- Do NOT re-run sdd-reverse-engineer for the whole system.
- Optionally append a short ADR note under docs/sdd/calculadora-bmc/ if tool surface growth is material; else skip to G2.

G2 Implement (gap #1 only)
- Evidence: tests/toolStats.test.js asserts AGENT_TOOLS.length === 42; runtime exports 48.
- Fix: update the invariant to 48 (or derive from AGENT_TOOLS.length with a floor/changelog comment), and verify no accidental duplicate tool names.
- Related P0 if cheap in same PR: declare FINANZAS_MODULE_PASSWORD in secrets manifest consumed by scripts/gate-secrets-drift.mjs so `npm run test:api` passes — OR split to second commit if scope creeps.
- Do not change ASSISTANTS_ACTIVE, pricing, or human gates.

G3 Verify
- BMC_DISK_PRECHECK_SKIP=1 npm run gate:local
- Optionally: doppler run --project bmc-backend --config prd -- npm run smoke:prod (expect 9/9)
- Do not deploy.

G4 Score docs
- After gate green: run sdd-quality-auditor on docs/sdd/calculadora-bmc/SDD.md (separate track if PR must stay <500 LOC).

G5 Close gaps
- Only if auditor produces GAP-PLAN with P0 doc gaps; else handoff.

Constraints: no Invoque full team; no invent success on OAuth/Meta; secrets names only in docs.
```

---

## Recent developments (citados PROJECT-STATE)

- 2026-07-19: HCS audit 98.2; SDD as-built full system; Hands-free #717 prod  
- 2026-07-18: Finanzas cash-flow/tests; MLOMS P0; competitive strategy docs; JWT refresh single-flight  
- 2026-07-17: HCS go-live; Co-Work; flete wizard; finanzas password gate  

---

## Risks / blockers (solo evidencia)

1. **gate:local rojo** — bloquea higiene pre-PR [CONFIRMED esta corrida].  
2. **#610** — Claude out of credits; seam gemini [CONFIRMED assistants + gh issue OPEN].  
3. **Meta Ads conversion dark** — pixel env pendiente [PROJECT-STATE; no verificado en Vercel UI esta corrida].  
4. **Local stack down** — contracts/goldens no medidos [CONFIRMED].
