# JUDGE REPORT — RUN 2026-05-16 / run56

**Contexto:** Evaluación delta de **~7 semanas** (2026-03-28 → 2026-05-16) acumuladas desde el último juicio formal (run55, 2026-03-27). No hubo invocación full-team orquestada; el trabajo se organizó en sesiones autónomas temáticas. Los roles evaluados son los que dejaron huella verificable en git log + PROJECT-STATE. Roles sin actividad rastreable en el período se marcan N/A y no afectan el promedio.

**Referencias:**
`docs/team/PROJECT-STATE.md` (entradas 2026-03-28 → 2026-05-16) · git log (56 commits) · `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` · PRs #213–#239 (GitHub) · `docs/team/run-reports/` (reportes por sesión autónoma)

**Metodología:** Escala 1–5 por criterio universal (gate compliance, propagación, PROJECT-STATE update, scope discipline, handoff quality, security, documentation). Promedio por rol = media de los criterios que aplican. Promedio global = media de roles con nota numérica. Judge = N/A (auto-evaluación).

---

## Criterios por rol

| Rol | Nota (1–5) | Comentario breve |
|-----|------------|------------------|
| **bmc-calc-specialist** | 4 | Tres PRs de pricing bien ejecutados: #213 FIJACIONES web +10%, #214 (3 SKUs web<venta + PU80MM + doc unificación), `b149094` ISOROOF_FOIL 50mm markup ×1.40. Todos con gate `gate:local` verde. Sin handoff explícito a bmc-sheets-mapping sobre impacto en MATRIZ (los cambios son en `constants.js`; el doc de unificación existe pero no genera Log for). Scope disciplinado; sin cálculos especulativos. |
| **bmc-panelin-chat** | 4 | F1 Admin Cot v2: 10 PRs intra-day 2026-05-14 con AbortController (#224), badge Sugerido + rule engine 37 tests (#225), WA timeline inline (#226), email-ingest workflow (#227), row-create (#228), CRM ML surface + PATCH Responsable (#229), Playwright smokes (#231, #232, #233). Rebases complejos ejecutados sin pérdida de cambios. Punto débil: el open question de `Responsable` dropdown (códigos vs nombres) fue detectado antes de merge pero no bloqueó los PRs — se resolvió luego en T3, implicando re-trabajo. |
| **bmc-security** | 4 | Top-30 B6 `GET /api/followups` → `requireAuth` (#A10); dual-write `PARTIAL_WRITE` signal; CSV injection guard en `clientQuotesSheetSync.js` (#214 wave B4); `requireDevModeAuth` typo fix (Cloud Run unblock `3ce36db`). Remoción `promptfoo` (#215, cierra 7/8 vulns). GSM secrets migration completada 2026-04-30 (9 claves en Secret Manager). Un gap residual: sanitizador CSV-injection de `wolfboard/row` aún pendiente (documentado pero no cerrado en el período). |
| **bmc-deployment** | 4 | Cloud Run unblock crítico: dos bugs encadenados resueltos (`canvas` huérfano + `requireDevModeAuth` typo — `9faa3f8` + `3ce36db`), liberando 51 commits acumulados. `package-lock.json` regenerado (`94aa500`, 2781 líneas huérfanas). Deploy Cloud Run rev `00371-j97` + Vercel prod verificados. `deploy-calc-api.yml` path filter ampliado para incluir `package.json|package-lock.json`. Sin bypass de gates en el período rastreable. Punto a mejorar: workflow corrió sin evidencia de `pre-deploy` checklist antes de al menos 2 hotfixes urgentes. |
| **bmc-docs-sync** | 4 | PROJECT-STATE con entradas detalladas y consistentes para cada bloque (WA, F1, pricing, security, observability, infra). Rotación a `PROJECT-STATE-ARCHIVE-2026Q1-Q2.md` (379 KB → 99 KB, T5 commit `00559d0`) restaura legibilidad. CLAUDE.md actualizado (#238 — 11 reviewer issues). Gaps: algunas entradas no incluyen el patrón "Affects: [rol]" (especialmente en los B-runs del 2026-05-12), dificultando trazabilidad de propagación para el Juez. |
| **bmc-sheets-mapping** | 3 | T3 reconcilió `cotizacionAssignment.js` con planilla CRM_Operativo!Parametros: `OPERATOR_CODES` MP/RA/TIN/SA/PANELIN, `normalizeOperatorCode`, server validation en `bmcDashboard.js:854-906`, 53 test asserts. Handoff a Matías documentado (agregar `"Sa"` en Sheets). Pendiente verificable: la planilla `Parametros` aún no refleja los 5 operadores canónicos (Sandra ausente en dropdown nativo). Score 3 porque el artefacto canónico de Sheets (la planilla real) no fue actualizado en el período — sólo el código lo adoptó. |
| **calculo-especialist** | 3 | SVG cota halo blanco (B6 commit `a688bd9`, `paint-order: stroke fill`). Scope correcto y acotado. Nota 3 porque la contribución fue puntual y de baja complejidad; sin handoff documentado y sin tests asociados al cambio SVG. |
| **bmc-api-contract** | 4 | `PATCH /api/cotizaciones/<id>` adicionado para Responsable (#229), con validación server-side de `OPERATOR_CODES` y respuesta 400 explícita. `GET /api/followups` drift corregido (ahora `requireAuth`). `parseCrmRowAtoAK` retorna `_meta` additive. Playwright smokes (#231) cubren 3 features F1. Sin evidencia de ejecución formal de `npm run test:contracts` documentada para las nuevas rutas del período. |
| **claude (main thread)** | 4 | T1 triage cursor-bot: 7 PRs cerrados como superseded, 13 con recomendaciones merge/close documentadas, 6 flagged para Tier B. T2 fixes #237 (CLAUDE.md) + #238 (rename + 11 reviewer issues). T3 reconcile Responsable (ver bmc-sheets-mapping). T5 cleanup repo -7.7 MB + rotación PROJECT-STATE. Scope bien disciplinado; no se abrieron deudas técnicas nuevas. Sin commit de judge report en el período (este reporte cierra ese gap). |
| **bmc-fiscal** | N/A | Sin actividad rastreable en el período. Tests fiscales del 2026-04-27 (irae, bps shape) fueron ejecutados por claude/main en el período de evaluación anterior. No penaliza. |
| **bmc-panelin-mcp** | N/A | Sin nuevas rutas MCP en el período (período anterior cerró 28 tools). No penaliza. |
| **Orchestrator** | N/A | No hubo invocación full-team en el período. Las sesiones fueron autónomas temáticas. |
| **MATPROMT / Parallel / Serial / SIM / SIM-REV / Reporter / Repo Sync** | N/A | Sin run orquestado en el período. |
| **Judge** | — | Auto-evaluación excluida. |

---

## Entregables del período (run56)

### Bloque F1 Admin Cot v2 (2026-05-14 — 10 PRs)

- #224 Sugerir IA per-row + AbortController
- #225 Suggested badge + `cotizacionAssignment.js` rule engine (37 tests)
- #226 WA timeline inline accordion
- #227 email-ingest scheduled workflow + runbook
- #228 "+ Nueva consulta" + `POST /api/wolfboard/row-create`
- #229 CRM ML rows + Responsable PATCH
- #231 3 Playwright smokes F1
- #232 noise-filter fix anon session
- #233 Hybrid RBAC + Phase 3 + outcome model (+706/-81 LOC, 21 files, 64 asserts)
- #234–#236 docs + smoke fixes

### Frontend B-runs (2026-05-12)

B1 consistency cleanup · B2 7 UX wins · B3 spinner · B4 focus-visible · B5 mobile responsive WA cockpit · B6 SVG cota halo · B7 JSDoc

### Server B-runs (2026-05-12)

B1 ML cache key SHA-256 + `parseCrmRowAtoAK _meta` · B2 PROJECT-STATE entries

### Cloud Run unblock (2026-05-12–13)

`9faa3f8` canvas dep removida · `3ce36db` typo `requireDevModeAuth` · `94aa500` package-lock.json regen (2781 líneas huérfanas)

### Pricing wave (2026-05-12)

#213 FIJACIONES web +10% · #214 3 SKUs web<venta + PU80MM + unification doc · `b149094` ISOROOF_FOIL 50mm

### Security hardening (2026-05-12)

B6 `GET /api/followups` requireAuth · B4 dual-write PARTIAL_WRITE + CSV injection guard · #215 remoción promptfoo (7/8 vulns)

### Esta sesión T1–T5 (2026-05-15–16)

- **T5:** cleanup repo root -7.7 MB, 64 archivos · PROJECT-STATE rotación 379 KB → 99 KB (commit `00559d0` + PR draft #239)
- **T3:** Responsable dropdown reconcile — `OPERATOR_CODES` MP/RA/TIN/SA/PANELIN · `normalizeOperatorCode` · server 400 validation · 53 test asserts (commit `d228f1a`)
- **T2:** Fixes #237 (CLAUDE.md docs — 4 reviewer issues) + #238 (bmc-panelin-dev rename — 11 reviewer issues)
- **T1:** Triage cursor-bot — 7 PRs cerrados superseded, 13 con recomendaciones merge/close, 6 flagged Tier B local-git

### Arquitectura / observabilidad (período amplio 2026-04-15 → 2026-05-13)

- WA Cockpit F1-F5 (Postgres wa_*, Chrome extension MV3, enricher worker, routing rules, SLA worker, magic link auth)
- Comprador Identity Phases A-J (Supabase schema, OAuth Google, RBAC, quote persistence, Sheets sync)
- AE-Agent loopback unificación HTTP + quoteRegistry GCS
- Chat chips / SUGGEST_JSON SSE + wolfboard suggestions
- Plan-import CAD → presupuesto (Anthropic vision)
- Observability: structured `agent_tool_call` log → Cloud Logging
- Keys tooling: `keys:audit` + `keys:rotate` + `/api/agent/voice/health`
- Branch housekeeping: 199 → 52 branches remotas, 26 archive tags

---

## Flags

- **NOTE bmc-sheets-mapping:** La planilla `CRM_Operativo!Parametros` no refleja los 5 operadores canónicos al cierre del período. El código adoptó el canon pero la fuente de verdad (planilla) tiene divergencia. Pendiente manual Matías: agregar `"Sa"` en Sheets.
- **NOTE bmc-panelin-chat:** El open question de `Responsable` (códigos vs nombres) fue detectado antes del merge de #229 pero no bloqueó el PR — se resolvió en T3 un día después. El proceso funcionó, pero la detección tardía generó re-trabajo. Recomendación: formalizar un checklist de "drift config" antes de PRs que involucren dropdowns sincronizados con planillas.
- **WARNING bmc-api-contract:** No hay evidencia documentada de `npm run test:contracts` ejecutado contra las nuevas rutas F1 en el período (PATCH Responsable, POST row-create, GET ml-queue). Los Playwright smokes (#231) cubren el happy path en anon mode; las aserciones de contrato de shape son distintas. Deuda técnica activa.
- **NOTE bmc-deployment:** Al menos 2 hotfixes urgentes (Cloud Run unblock `3ce36db`, typo) llegaron a `main` sin evidencia de `npm run pre-deploy` previo. En emergencias es aceptable, pero el runbook debería definir el mínimo de gates para hotfixes (propuesta: `gate:local` obligatorio + smoke:prod post-deploy).
- **NOTE claude (main thread):** Los 13 PRs cursor-bot de T1 con recomendaciones "merge/close" no se ejecutaron — quedaron como recomendaciones documentadas para Matías. Correcto procedimiento para PRs que no son del thread actual, pero genera una cola abierta de deuda de PR triage. Los 6 Tier B sin clasificar definitiva representan un riesgo de pérdida de contexto si no se procesan en el próximo run.

---

## Honestidad de pendientes

### Abiertos al cierre del período (2026-05-16)

1. **Planilla CRM_Operativo!Parametros:** Dropdown nativo de Sheets no tiene `"Sa"` (Sandra). Server escribe sin error (no hay Data Validation rule que bloquee), pero la UI in-sheet muestra inconsistencia hasta que Matías lo agregue manualmente.
2. **Tier C PRs cursor-bot (T1):** 13 PRs con recomendación sin ejecutar + 6 flagged Tier B sin cierre definitivo. Cola de decisión pendiente de Matías para merge/close.
3. **F1 producción validation:** Los Playwright smokes (#231) pasan en anon mode (early-exit branch). Para validación completa de drawer assertions se requiere `API_AUTH_TOKEN` seteado en `.env` del server — documentado pero no ejecutado.
4. **`test:contracts` para rutas F1:** PATCH `/api/cotizaciones/<id>`, POST `/api/wolfboard/row-create`, GET `/api/crm/cockpit/ml-queue` sin cobertura en el validador de contratos offline.
5. **CSV injection en `wolfboard/row`:** PR #144 cubrió `crmAppend`; el endpoint `/api/wolfboard/row` sigue fuera de scope del sanitizador (documentado desde 2026-05-06, no cerrado en el período).
6. **Dependabot npm audit:** `basic-ftp` high, `hono` + `ip-address` moderate — plan de bump sin `--force` pendiente.
7. **Comprador Identity / WA Pro go-live:** Migrations Supabase no aplicadas; tab "Base de datos cotis de clientes" no creada; WA Pro Fase D UI + fe3-metrics pendientes. Fuera del scope de este run56 pero relevantes para el juez histórico.

---

## Promedio orientativo (run56)

Roles con nota numérica: bmc-calc-specialist (4), bmc-panelin-chat (4), bmc-security (4), bmc-deployment (4), bmc-docs-sync (4), bmc-sheets-mapping (3), calculo-especialist (3), bmc-api-contract (4), claude/main (4).

**9 roles con nota → promedio run56: ~3.89 / 5**

Nota: el promedio más bajo respecto a runs anteriores (~4.4–4.9) refleja (a) que este es un delta acumulado de 7 semanas sin orquestación formal — varios roles no dejaron huella verificable, (b) dos notas de 3 (sheets-mapping, calculo-especialist) por entregables incompletos o sin handoff, y (c) el criterio de honestidad aplicado a pendientes documentados pero no cerrados. La cantidad de trabajo real entregado en el período es alta — el score refleja proceso, no volumen.

---

## Top 3 mejoras para el próximo run

1. **Formalizar checklist de "config drift" pre-PR para dropdowns sincronizados con planillas.** El patrón `cotizacionAssignment.js` vs `CRM_Operativo!Parametros` se repitió (detectado post-merge en #229, resuelto en T3). Propuesta: antes de cualquier PR que introduzca una lista de opciones hardcodeada en el frontend/backend, el agente responsable debe cruzar con la planilla canon (Parametros tab) y documentarlo en la descripción del PR. Responsables: bmc-panelin-chat, bmc-sheets-mapping.

2. **Ejecutar `npm run test:contracts` contra las rutas F1 antes del próximo merge a main.** Actualmente PATCH `/api/cotizaciones/<id>`, POST `/api/wolfboard/row-create` y GET `/api/crm/cockpit/ml-queue` no tienen cobertura en el validador de contratos offline. El contrato es la fuente de verdad para bmc-api-contract; sin él, cualquier refactor silencioso puede romper el frontend sin alerta. Responsable: bmc-api-contract.

3. **Definir protocolo de hotfix: gate mínimo obligatorio incluso en emergencias.** Los dos unblocks críticos de Cloud Run (canvas + typo) llegaron a `main` sin evidencia de `gate:local` previo. Propuesta en `CONTRIBUTING.md`: para hotfixes, el mínimo es `npm run gate:local` + smoke:prod post-deploy inmediato, con nota explícita en el PR body de que se omitió `gate:local:full` y por qué. Responsable: bmc-deployment.

---

## Promedio histórico actualizado

| Rol | Promedio histórico anterior | Score run56 | Nuevo promedio (orientativo) |
|-----|-----------------------------|-------------|------------------------------|
| bmc-calc-specialist / Calc | 4.8 | 4 | ~4.7 |
| bmc-panelin-chat | N/A previo | 4 | 4.0 (run56 inaugural) |
| bmc-security / Security | 5.0 | 4 | ~4.9 |
| bmc-deployment | N/A previo | 4 | 4.0 (run56 inaugural) |
| bmc-docs-sync | N/A previo | 4 | 4.0 (run56 inaugural) |
| bmc-sheets-mapping / Mapping | 5.0 | 3 | ~4.8 |
| calculo-especialist / RoofPlan | N/A previo | 3 | 3.0 (run56 inaugural) |
| bmc-api-contract / Contract | 4.90 | 4 | ~4.85 |
| claude (main thread) | N/A previo | 4 | 4.0 (run56 inaugural) |

**Promedio global run56: ~3.89 / 5** (9 roles con nota; metodología delta 7 semanas sin orquestación formal)

Ver `JUDGE-REPORT-HISTORICO.md` para historial completo de runs.
