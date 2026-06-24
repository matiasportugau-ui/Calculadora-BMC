# RECON-ORQUESTACION.md

> Reconocimiento **estrictamente READ-ONLY** de la "capa viva de orquestación de desarrollo".
> No se modificó código, git, PRs/issues ni infra. Cualquier paso que requería escribir se registra como **acción recomendada**.
> Repo: `matiasportugau-ui/calculadora-bmc` · branch base de análisis: `main` (run ejecutado desde `claude/beautiful-bohr-gywjnu`, HEAD `f41d68a`) · fecha: 2026-06-17.

```json
{
  "fase_a_status": "parcialmente_hecho",
  "prs": {"total": 104, "stale_cerrables": 82, "mergeables": 10, "conflictos": 0, "decision_dueno": 7},
  "issues_abiertos": 3,
  "cierre_en_bloque_seguro": 82
}
```

**Caveats del JSON (para downstream):**
- `mergeables: 10` es **inferencia** — NO se verificaron checks verdes ni conflictos por-PR.
- `conflictos: 0` = **ninguno confirmado**; el campo `mergeable`/`mergeStateStatus` NO se consultó por-PR (serían ~104 llamadas) → **duda abierta**, no un cero real.
- Quedan **5 PRs `duda_abierta`** (238, 237, 212, 190, 187) que no entran en ninguno de los 4 buckets del schema.

---

## A) Reconciliación de la capa de orquestación (capability-por-capability)

### Nota de reconciliación previa — hay DOS "orquestadores" distintos (no confundir)
| | Qué es | Estado | Evidencia |
|---|---|---|---|
| **`presupuestacion-orchestrator`** | Automatización del **flujo de cotización** (negocio) | **YA CONSTRUIDO** | `server/lib/presupOrchestrator.js`, `server/lib/presupSegConsumer.js`, `server/routes/internal/presupOrchestrator.js`, `server/prompts/presup-orchestrator/*`, `evals/promptfoo/presup-orchestrator.yaml`, `server/lib/approvalRouter.js`. `docs/team/PROJECT-STATE.md` registra Fase 0 (2026-05-29) y Fase 1 seg+consumer (2026-06-01). |
| **"capa viva de orquestación de desarrollo"** | Meta-capa **dev/ops** (estado prod/git/local, agenda viva, dispatch async) | **NUEVO** (lo de este recon) | Su "Fase A" = `/version` + SHA embed + reconciler → tabla siguiente |

> ⚠️ Los archivos `goal-prompt-presup-orchestrator-run-layer*.md` (raíz del repo) describen el **primer** orquestador (cotización), que ya está implementado. NO son la capa dev/ops que se quiere construir. Reutilizar patrones (saga/state-machine, guardrails de costo, `approvalRouter`) pero no re-implementar.

### Tabla de overlap — Fase A
| Capability | Estado | Evidencia (path:línea / PR#) | Etiqueta epistémica |
|---|---|---|---|
| Endpoint **`/version`** (commit SHA + `CALCULATOR_DATA_VERSION` + `built_at`) | **parcial** | No existe ruta `/version` (en `server/index.js` solo `/capabilities` `:194`, `/health` `:198`; ninguna `/version`). `/capabilities` ya expone `build = { gitSha, version, deployedAt }` (`server/agentCapabilitiesManifest.js:12-16`) **pero sin** `CALCULATOR_DATA_VERSION` ni `built_at`. El dato existe suelto: `src/data/calculatorDataVersion.js:4-5` (`CALCULATOR_DATA_VERSION="7699a48a84"`, `..._DATE`), inyectado en `/calc` (`server/routes/calc.js:70-71`) pero no consolidado en un endpoint. | hecho confirmado |
| **SHA embebido en el build** (Cloud Build / CI substitution) | **ya existe** | `server/Dockerfile:17-18` → `ARG GIT_SHA=unknown` + `ENV GIT_SHA=${GIT_SHA}`; `.github/workflows/deploy-calc-api.yml:133` → `--build-arg GIT_SHA=${{ steps.sha.outputs.sha }}` (tag de imagen también por SHA, `:134`/`:144`); leído en runtime por `server/agentCapabilitiesManifest.js:13`. | hecho confirmado |
| **Reconciler de drift** (prod vs git vs local, de VERSION/SHA) | **falta** | Existen reconcilers **adyacentes de otro dominio**, ninguno compara versión/SHA entre prod/git/local: `scripts/check-env-drift.mjs` (drift de **env vars**; gate CI `env-drift`), `scripts/gate-secrets-drift.mjs` (secrets Cloud Run), `scripts/smoke-prod-api.mjs` (liveness prod + `public_base_url`, **no** compara SHA/version), `scripts/reconcile-calc-vs-matriz.mjs` y `scripts/reconcile-productos-maestro.mjs` (**datos de Sheets**, no build). | hecho confirmado (+ duda abierta sobre si "drift" se define solo como VERSION o como estado amplio) |

### Síntesis (A)
La Fase A **no es de cero**: el **SHA-embed ya ships** end-to-end (Dockerfile + CI + `/capabilities`) y el dato `CALCULATOR_DATA_VERSION` ya se genera y se inyecta en `/calc`. El gap concreto es (1) un **endpoint `/version` dedicado** que consolide `gitSha` + `CALCULATOR_DATA_VERSION` + `built_at` (hoy dispersos entre `/capabilities` y `/calc`), y (2) un **reconciler de versión** prod-vs-git-vs-local, que es lo único realmente net-new (los reconcilers existentes cubren env/secrets/Sheets, no build/version).

---

## B) Triage del backlog de PRs e issues

**Criterios deterministas aplicados parejo** (hoy = 2026-06-16; "stale" = `updatedAt` estrictamente anterior a **2026-05-17**, i.e. >30 días):
- **[stale/agent-draft cerrable]**: branch con prefijo de agente (`claude/`,`copilot/`,`cursor/`,`codex/`) **AND** (`isDraft` **OR** stale **OR** `mergeable=CONFLICTING`). Autor bot/app (`cursor[bot]`, `Copilot`, `dependabot[bot]`) refuerza origen-agente. *(Aproximación: no se inspeccionó autoría humana commit-por-commit en 104 PRs; se usa prefijo de branch + autor como señal de origen-agente.)*
- **[mergeable limpio]**: `mergeable=MERGEABLE` **AND** checks verdes **AND** `reviewDecision ≠ CHANGES_REQUESTED`. → No verificable por-PR en este run; los marcados son **candidatos** (non-draft + recientes + sin keyword sensible), etiqueta **inferencia**.
- **[con conflictos]**: `mergeable=CONFLICTING` con trabajo/valor humano. → **0 confirmados** (no se consultó `mergeable` por-PR) → **duda abierta**.
- **[requiere decisión dueño]**: toca precios/Matriz, secrets/`.env`, schema Supabase/Postgres, o arquitectura (auth/deploy/Cloud Run/orquestador). Este overlay **gana** sobre "mergeable limpio".

### Conteo por clase
| Clase | N | PR# |
|---|---|---|
| stale/agent-draft cerrable | **82** | ver lista de cierre seguro |
| requiere decisión dueño | **7** | 349, 330, 323, 320, 290, 287, 182 |
| mergeable-candidato (inferencia) | **10** | 368, 366, 331, 321, 299, 289, 262, 258, 257, 278 |
| duda abierta | **5** | 238, 237, 212, 190, 187 |
| **Total** | **104** | |

### Tabla de PRs clasificados (104)
| PR# | Título (≤55) | Autor | Branch | Draft | Updated | Clase | Razón | Etiqueta |
|---|---|---|---|---|---|---|---|---|
| 368 | feat(gemini): reasoner/executor AI config + legacy V3 | matiasportugau-ui | claude/ | N | 2026-06-16 | mergeable-candidato | non-draft + reciente | inferencia |
| 367 | fix: harden Claude workflow triggers | cursor[bot] | cursor/ | Y | 2026-06-16 | stale/agent | branch agente + draft | hecho confirmado |
| 366 | Add Claude Code GitHub Workflow | matiasportugau-ui | add-claude-… | N | 2026-06-16 | mergeable-candidato | non-draft + reciente | inferencia |
| 365 | fix: normalize live MATRIZ EPS price parity by header | cursor[bot] | cursor/ | Y | 2026-06-15 | stale/agent | branch agente + draft | hecho confirmado |
| 364 | fix(pricing): close residual MATRIZ catalog drift | cursor[bot] | cursor/ | Y | 2026-06-15 | stale/agent | branch agente + draft | hecho confirmado |
| 363 | fix: dedupe MATRIZ rows before pricing import/push | cursor[bot] | cursor/ | Y | 2026-06-15 | stale/agent | branch agente + draft | hecho confirmado |
| 362 | fix(pricing): guard CAN.ISDC120 and PU250MM mapping | cursor[bot] | cursor/ | Y | 2026-06-15 | stale/agent | branch agente + draft | hecho confirmado |
| 360 | docs(state): track Shopify OAuth 500-vs-503 DB-less | matiasportugau-ui | claude/ | Y | 2026-06-15 | stale/agent | branch agente + draft | hecho confirmado |
| 357 | fix: T1 perfilería por pieza + desfase de columnas | matiasportugau-ui | claude/ | Y | 2026-06-16 | stale/agent | branch agente + draft | hecho confirmado |
| 356 | test: cover pricing catalog regressions | cursor[bot] | cursor/ | Y | 2026-06-15 | stale/agent | branch agente + draft | hecho confirmado |
| 355 | feat: project status dashboard /hub/proyecto | matiasportugau-ui | claude/ | Y | 2026-06-16 | stale/agent | branch agente + draft | hecho confirmado |
| 354 | test: gate WOLF catalog golden cases | cursor[bot] | cursor/ | Y | 2026-06-14 | stale/agent | branch agente + draft | hecho confirmado |
| 352 | fix: restore ISOFRIG catalog invariants | cursor[bot] | cursor/ | Y | 2026-06-13 | stale/agent | branch agente + draft | hecho confirmado |
| 351 | fix(auth): make Shopify OAuth state cookie redirect-safe | cursor[bot] | cursor/ | Y | 2026-06-13 | stale/agent | branch agente + draft (auth, superseded) | hecho confirmado |
| 350 | fix: make GSDECAM100 reachable in ISODEC quotes | cursor[bot] | cursor/ | Y | 2026-06-13 | stale/agent | branch agente + draft | hecho confirmado |
| 349 | feat(panelin): Fase6 realtime hub + root panelin auth | matiasportugau-ui | feat/ | N | 2026-06-13 | decisión dueño | toca auth/arquitectura realtime | hecho confirmado |
| 347 | test: cover catalog golden pricing regressions | cursor[bot] | cursor/ | Y | 2026-06-13 | stale/agent | branch agente + draft | hecho confirmado |
| 346 | Rescue Tier B cursor-bot PRs (test coverage, WA) | Copilot | copilot/ | Y | 2026-06-13 | stale/agent | branch agente + draft | hecho confirmado |
| 344 | fix: restrict ActivityWatch activity to operators | cursor[bot] | cursor/ | Y | 2026-06-13 | stale/agent | branch agente + draft | hecho confirmado |
| 343 | fix: warn on ISOFRIG camera roof fallback | cursor[bot] | cursor/ | Y | 2026-06-13 | stale/agent | branch agente + draft | hecho confirmado |
| 342 | fix(traktime): secure manual entries and hours report | cursor[bot] | cursor/ | Y | 2026-06-13 | stale/agent | branch agente + draft (hardening) | hecho confirmado |
| 339 | fix: enforce secrets drift gate before deploy | cursor[bot] | cursor/ | Y | 2026-06-13 | stale/agent | branch agente + draft (+secrets kw) | hecho confirmado |
| 337 | fix: harden Panelin critical paths | cursor[bot] | cursor/ | Y | 2026-06-12 | stale/agent | branch agente + draft (hardening) | hecho confirmado |
| 336 | test: cover bug reports route regressions | cursor[bot] | cursor/ | Y | 2026-06-12 | stale/agent | branch agente + draft | hecho confirmado |
| 335 | fix: harden FacturaExpress and Panelin mutations | cursor[bot] | cursor/ | Y | 2026-06-12 | stale/agent | branch agente + draft (hardening) | hecho confirmado |
| 334 | fix: secure Panelin FacturaExpress surfaces | cursor[bot] | cursor/ | Y | 2026-06-12 | stale/agent | branch agente + draft (hardening) | hecho confirmado |
| 333 | fix: guard Panelin platform routes | cursor[bot] | cursor/ | Y | 2026-06-12 | stale/agent | branch agente + draft (hardening) | hecho confirmado |
| 331 | fix: Panelin BMC Platform v1 FacturaExpress review | matiasportugau-ui | fix/ | N | 2026-06-13 | mergeable-candidato | non-draft + reciente | inferencia |
| 330 | fix(panelin): auth + rate-limit + transactional PATCH | matiasportugau-ui | fix/ | Y | 2026-06-16 | decisión dueño | toca auth | hecho confirmado |
| 329 | fix: keep catalog range gate for duplicate SKUs | cursor[bot] | cursor/ | Y | 2026-06-11 | stale/agent | branch agente + draft | hecho confirmado |
| 323 | feat(panelin): floating chat + ISOFRIG PIR pricing | matiasportugau-ui | feat/ | N | 2026-06-11 | decisión dueño | toca pricing | hecho confirmado |
| 322 | test: cover WA token refresh rollout | cursor[bot] | cursor/ | Y | 2026-06-11 | stale/agent | branch agente + draft | hecho confirmado |
| 321 | fix(agent): honor apiKeysOverride in callAgentOnce | matiasportugau-ui | claude/ | N | 2026-06-12 | mergeable-candidato | non-draft + reciente | inferencia |
| 320 | feat: ISOFRIG PIR panel family + matriz:sync-auto | matiasportugau-ui | feat/ | N | 2026-06-11 | decisión dueño | toca matriz/pricing | hecho confirmado |
| 319 | fix: harden WA token refresh rollout | cursor[bot] | cursor/ | Y | 2026-06-10 | stale/agent | branch agente + draft | hecho confirmado |
| 318 | fix: complete WA token refresh rollout | cursor[bot] | cursor/ | Y | 2026-06-10 | stale/agent | branch agente + draft | hecho confirmado |
| 316 | fix(deploy): preserve API auth token secret | cursor[bot] | cursor/ | Y | 2026-06-10 | stale/agent | branch agente + draft (+secret kw) | hecho confirmado |
| 314 | fix: preserve Cloud Run secrets on deploy | cursor[bot] | cursor/ | Y | 2026-06-10 | stale/agent | branch agente + draft (+secret kw) | hecho confirmado |
| 311 | fix: require admin for WA tenant settings | cursor[bot] | cursor/ | Y | 2026-06-10 | stale/agent | branch agente + draft | hecho confirmado |
| 310 | fix: disable cockpit token minting in production | cursor[bot] | cursor/ | Y | 2026-06-10 | stale/agent | branch agente + draft (hardening) | hecho confirmado |
| 308 | test: cover Tasks Phase D scheduling helpers | cursor[bot] | cursor/ | Y | 2026-06-10 | stale/agent | branch agente + draft | hecho confirmado |
| 306 | fix: harden team-assist rate limit key | cursor[bot] | cursor/ | Y | 2026-06-10 | stale/agent | branch agente + draft (dup de 305) | hecho confirmado |
| 305 | fix: harden team assist rate limit key | cursor[bot] | cursor/ | Y | 2026-06-10 | stale/agent | branch agente + draft (dup de 306) | hecho confirmado |
| 303 | fix: require opt-in for runtime API token fallback | cursor[bot] | cursor/ | Y | 2026-06-10 | stale/agent | branch agente + draft | hecho confirmado |
| 301 | docs: plano profesional + presupuesto preliminar | matiasportugau-ui | claude/ | Y | 2026-06-09 | stale/agent | branch agente + draft | hecho confirmado |
| 300 | test: cover bug reporting API regressions | cursor[bot] | cursor/ | Y | 2026-06-09 | stale/agent | branch agente + draft | hecho confirmado |
| 299 | fix(market-intel): graceful degradation for Error | matiasportugau-ui | claude/ | N | 2026-06-09 | mergeable-candidato | non-draft + reciente | inferencia |
| 298 | fix(deploy): inject API_AUTH_TOKEN into Cloud Run | matiasportugau-ui | claude/ | Y | 2026-06-09 | stale/agent | branch agente + draft; ⚠ toca deploy/secret (ver nota) | duda abierta |
| 297 | test: cover bug reports API regressions | cursor[bot] | cursor/ | Y | 2026-06-08 | stale/agent | branch agente + draft | hecho confirmado |
| 296 | fix: restore webhook handlers and app parsing | cursor[bot] | cursor/ | Y | 2026-06-07 | stale/agent | branch agente + draft | hecho confirmado |
| 295 | fix: protect Productos Maestro link writes | cursor[bot] | cursor/ | Y | 2026-06-07 | stale/agent | branch agente + draft | hecho confirmado |
| 293 | test: cover Google Calendar task mirror client | cursor[bot] | cursor/ | Y | 2026-06-07 | stale/agent | branch agente + draft (dup de 280) | hecho confirmado |
| 292 | fix: address P0/P1 review blockers on bug-reports | Copilot | copilot/ | N | 2026-06-07 | stale/agent | autor agente (Copilot) | hecho confirmado |
| 290 | fix(deploy): align Cloud Run --set-secrets | matiasportugau-ui | fix/ | Y | 2026-06-07 | decisión dueño | toca deploy/secrets | hecho confirmado |
| 289 | ship: bug-reports feature + goal tooling | matiasportugau-ui | ship/ | N | 2026-06-07 | mergeable-candidato | non-draft + reciente | inferencia |
| 287 | ci+test: golden price guard + channels prod | matiasportugau-ui | claude/ | N | 2026-06-07 | decisión dueño | toca pricing (golden guard) | hecho confirmado |
| 286 | docs: working agreement (plan-first, no bypass) | matiasportugau-ui | claude/ | Y | 2026-06-07 | stale/agent | branch agente + draft | hecho confirmado |
| 285 | fix: align Team Assist chat timeout with server | cursor[bot] | cursor/ | Y | 2026-06-07 | stale/agent | branch agente + draft | hecho confirmado |
| 283 | Gate 0 — Seguridad previa (Proyecto Tablero SDD) | matiasportugau-ui | claude/ | Y | 2026-06-07 | stale/agent | branch agente + draft | hecho confirmado |
| 281 | docs(audit): exhaustive BMC technical audit | matiasportugau-ui | claude/ | Y | 2026-06-07 | stale/agent | branch agente + draft | hecho confirmado |
| 280 | test: cover Google Calendar task mirror client | cursor[bot] | cursor/ | Y | 2026-06-06 | stale/agent | branch agente + draft (dup de 293) | hecho confirmado |
| 279 | test: cover Tasks rich scheduling helpers | cursor[bot] | cursor/ | Y | 2026-06-05 | stale/agent | branch agente + draft | hecho confirmado |
| 278 | chore(deps): bump react-router 6.30.3 → 7 | dependabot[bot] | dependabot/ | N | 2026-06-15 | mergeable-candidato | bot + reciente; ⚠ bump MAYOR (revisar) | inferencia |
| 277 | test: cover MATRIZ pricing contract | cursor[bot] | cursor/ | Y | 2026-06-04 | stale/agent | branch agente + draft | hecho confirmado |
| 275 | test: cover MATRIZ pricing scripts | cursor[bot] | cursor/ | Y | 2026-06-03 | stale/agent | branch agente + draft | hecho confirmado |
| 273 | fix: stale production deploy attempts skip | Copilot | copilot/ | Y | 2026-06-03 | stale/agent | autor agente + draft | hecho confirmado |
| 272 | Make deploy-vercel stale-SHA guard skip prod | Copilot | copilot/ | Y | 2026-06-03 | stale/agent | autor agente + draft (dup de 271) | hecho confirmado |
| 271 | Make deploy-vercel stale SHA guard skip prod | Copilot | copilot/ | Y | 2026-06-03 | stale/agent | autor agente + draft (dup de 272) | hecho confirmado |
| 270 | ci(channels_pipeline): skip suggest-response | Copilot | copilot/ | Y | 2026-06-03 | stale/agent | autor agente + draft | hecho confirmado |
| 269 | Improve channels CI smoke diagnostics | Copilot | copilot/ | N | 2026-06-03 | stale/agent | autor agente (Copilot) | hecho confirmado |
| 268 | Fix GitHub Actions Node.js 20 deprecation | Copilot | copilot/ | Y | 2026-06-03 | stale/agent | autor agente + draft | hecho confirmado |
| 267 | Update setup-gcloud to v3 for Node.js 24 | Copilot | copilot/ | Y | 2026-06-03 | stale/agent | autor agente + draft | hecho confirmado |
| 266 | Opt into Node.js 24 for GitHub Actions | Copilot | copilot/ | N | 2026-06-03 | stale/agent | autor agente (Copilot) | hecho confirmado |
| 265 | fix(pricing): skip incomplete MATRIZ rows | matiasportugau-ui | claude/ | Y | 2026-06-02 | stale/agent | branch agente + draft | hecho confirmado |
| 263 | fix(clientes-360): Resolve CI lint errors | Copilot | copilot/ | Y | 2026-06-01 | stale/agent | autor agente + draft | hecho confirmado |
| 262 | docs(clientes-360): Phase A MVP completion | matiasportugau-ui | claude/ | N | 2026-06-09 | mergeable-candidato | non-draft + reciente | inferencia |
| 261 | fix: resolve CI lint errors and disable Jekyll | matiasportugau-ui | claude/ | Y | 2026-06-01 | stale/agent | branch agente + draft | hecho confirmado |
| 258 | Claude/quote accuracy: precise failure snapshots | matiasportugau-ui | claude/ | N | 2026-05-30 | mergeable-candidato | non-draft + reciente (≥05-17) | inferencia |
| 257 | feat(cotizar): Phase A scaffold — Apps Script | matiasportugau-ui | wip/ | N | 2026-06-01 | mergeable-candidato | non-draft + reciente | inferencia |
| 256 | feat(wa-sla): scaffold multi-tenant support | matiasportugau-ui | claude/ | Y | 2026-05-27 | stale/agent | branch agente + draft | hecho confirmado |
| 255 | feat: admin suggest-response + WA preview | matiasportugau-ui | claude/ | Y | 2026-05-27 | stale/agent | branch agente + draft | hecho confirmado |
| 251 | test: cover Google Tasks sync token refresh | cursor[bot] | cursor/ | Y | 2026-05-24 | stale/agent | branch agente + draft | hecho confirmado |
| 249 | feat(evals): quote-alignment harness | matiasportugau-ui | claude/ | Y | 2026-05-22 | stale/agent | branch agente + draft | hecho confirmado |
| 247 | feat(tasks-module): Phase 1 complete | matiasportugau-ui | claude/ | Y | 2026-05-26 | stale/agent | branch agente + draft | hecho confirmado |
| 246 | docs: High-level architecture overview | matiasportugau-ui | claude/ | Y | 2026-05-19 | stale/agent | branch agente + draft | hecho confirmado |
| 243 | review-loop run 2026-05-17 — workflow + fixes | matiasportugau-ui | claude/ | Y | 2026-05-19 | stale/agent | branch agente + draft | hecho confirmado |
| 241 | feat(marketing-intel): Week 1 foundation (WIP) | matiasportugau-ui | claude/ | Y | 2026-05-19 | stale/agent | branch agente + draft | hecho confirmado |
| 239 | chore: complete Task 5 cleanup | matiasportugau-ui | claude/ | Y | 2026-05-16 | stale/agent | branch agente + draft + stale | hecho confirmado |
| 238 | feat(agents): bmc-paneelindev meta-router | matiasportugau-ui | feat/ | N | 2026-05-16 | duda abierta | feat/ (no agente), antiguo, non-draft | inferencia |
| 237 | docs(claude): add 5 sections learned during F1 | matiasportugau-ui | docs/ | N | 2026-05-16 | duda abierta | docs/ (no agente), antiguo, non-draft | inferencia |
| 219 | feat(artifact): single-file Claude Artifact build | matiasportugau-ui | claude/ | Y | 2026-05-17 | stale/agent | branch agente + draft | hecho confirmado |
| 216 | docs(housekeeping): audit log for branch cleanup | matiasportugau-ui | claude/ | Y | 2026-05-13 | stale/agent | branch agente + draft + stale | hecho confirmado |
| 212 | feat(ux): same-body joints non-interactive | matiasportugau-ui | feat/ | Y | 2026-05-12 | duda abierta | feat/ (no agente), antiguo, draft | inferencia |
| 210 | docs(claude): refresh CLAUDE.md — fix drift | matiasportugau-ui | claude/ | Y | 2026-05-11 | stale/agent | branch agente + draft + stale | hecho confirmado |
| 209 | feat(dashboard): scaffold Dashboard system | matiasportugau-ui | claude/ | Y | 2026-05-10 | stale/agent | branch agente + draft + stale | hecho confirmado |
| 205 | docs(claude): expand CLAUDE.md | matiasportugau-ui | claude/ | Y | 2026-05-09 | stale/agent | branch agente + draft + stale | hecho confirmado |
| 204 | fix(api): gate deep research + repair deploy | cursor[bot] | cursor/ | Y | 2026-05-16 | stale/agent | branch agente + draft + stale | hecho confirmado |
| 203 | test: cover requireGrant RBAC middleware | cursor[bot] | cursor/ | Y | 2026-05-09 | stale/agent | branch agente + draft + stale | hecho confirmado |
| 202 | fix: unblock API deploy + prevent KB poisoning | cursor[bot] | cursor/ | Y | 2026-05-16 | stale/agent | branch agente + draft + stale | hecho confirmado |
| 201 | feat(admin): merge Stats/Analytics tabs | matiasportugau-ui | claude/ | Y | 2026-05-27 | stale/agent | branch agente + draft | hecho confirmado |
| 200 | docs(notebooklm): capture pipeline + PDF deck | matiasportugau-ui | claude/ | Y | 2026-05-08 | stale/agent | branch agente + draft + stale | hecho confirmado |
| 190 | feat(kb-analytics): F4 — analytics endpoint | matiasportugau-ui | feat/ | N | 2026-05-08 | duda abierta | feat/ (no agente), antiguo, non-draft | inferencia |
| 187 | feat(kb-surface,ai-gateway): F2 + F3.1 + F3.2 | matiasportugau-ui | feat/ | N | 2026-05-08 | duda abierta | feat/ (no agente), antiguo, non-draft | inferencia |
| 182 | fix(ci): mount DATABASE_URL from Secret Manager | matiasportugau-ui | fix/ | Y | 2026-05-07 | decisión dueño | toca deploy/secrets/CI | hecho confirmado |

### Cierre en bloque SEGURO = 82 PRs
Justificación de seguridad: **cerrar ≠ borrar**. Las ramas y commits sobreviven al cierre; cualquiera de estos 82 se puede **reabrir o cherry-pick** después (el rescate documentado en issue **#240** NO se ve afectado). Por eso el cierre en bloque es seguro y reversible: limpia la cola sin perder trabajo.

Lista (82): `200 201 202 203 204 205 209 210 216 219 239 241 243 246 247 249 251 255 256 261 263 265 266 267 268 269 270 271 272 273 275 277 279 280 281 283 285 286 292 293 295 296 297 298 300 301 303 305 306 308 310 311 314 316 318 319 322 329 333 334 335 336 337 339 342 343 344 346 347 350 351 352 354 355 356 357 360 362 363 364 365 367`

**Comando (SE MUESTRA — NO se ejecuta; este run es read-only):**
```bash
# ILUSTRATIVO. En este entorno gh NO está disponible: la ejecución real iría por el
# GitHub MCP (update_pull_request con state=closed) por-PR. Versión gh equivalente:
for n in 200 201 202 203 204 205 209 210 216 219 239 241 243 246 247 249 251 255 256 \
         261 263 265 266 267 268 269 270 271 272 273 275 277 279 280 281 283 285 286 \
         292 293 295 296 297 298 300 301 303 305 306 308 310 311 314 316 318 319 322 \
         329 333 334 335 336 337 339 342 343 344 346 347 350 351 352 354 355 356 357 \
         360 362 363 364 365 367; do
  gh pr close "$n" --repo matiasportugau-ui/calculadora-bmc \
    --comment "Cierre en bloque: draft de agente stale/superseded. Rama preservada; reabrir o cherry-pick (cf. #240) cuando aplique."
done
```

### Issues abiertos (3)
| # | Título | Labels | Nota |
|---|---|---|---|
| 359 | infra(db): migration-drift hardening — supabase/migrations/ sin apply-gate | follow-up | Recomienda gate CI de drift + runbook antes de cerrar. Relevante a Fase A (drift). |
| 358 | data(catalog): inversión de precio lateral-cámara ISODEC — 200 mm > 250 mm | follow-up | Requiere verificar fuente Matriz (guardrail "nunca inventar precios"). |
| 240 | T1 Tier B — rescate de PRs cursor-bot (6 PRs a cherry-pick) | triage, follow-up, cursor-bot | Workflow definido; espera cherry-pick humano. Por esto, cerrar los 82 es reversible, no destructivo. |

### Nota de fidelidad de datos (B)
- **Campos efectivamente traídos** (por-PR, vía GitHub MCP `list_pull_requests` / `list_issues`): `number`, `title`, `author/user`, `headRefName`, `isDraft`, `updatedAt`, `labels`. **`gh` CLI no disponible** en el entorno → se usó GitHub MCP.
- **Campos NO traídos**: `mergeable`, `mergeStateStatus`, `reviewDecision` (requerían ~104 fetch por-PR). Por eso "mergeable limpio" y "con conflictos" no son verificables aquí: los 10 "mergeable-candidato" son **inferencia** y "conflictos" queda **duda abierta**.
- **Bordes marcados**: **#298** es draft `claude/` (regla stale/agent dispara primero) PERO toca deploy/secret (`API_AUTH_TOKEN` → Cloud Run) → lo etiqueté `duda abierta`: cerrar es reversible, pero conviene un vistazo antes por si no está superseded por #290. Los 5 `duda abierta` (238, 237, 212, 190, 187) son branches **no-agente** (`feat/`,`docs/`) y antiguos: no caen limpio en "stale/agent" ni en "mergeable limpio" → requieren ojo humano corto.

---

## C) Recomendación accionable — 3 próximas acciones (en orden)

| # | Acción | Costo de revisión del dueño | Desbloqueo |
|---|---|---|---|
| 1 | **Cerrar en bloque los 82 drafts de agente stale** (escanear títulos, excluir lo que se quiera rescatar por #240, cerrar). Reversible. | **~0.5 h** | Cola 104 → ~22. El backlog real (7 decisión-dueño + 10 mergeable + 5 duda) se vuelve revisable de un vistazo. Es el mayor alivio del cuello de botella. |
| 2 | **Revisar los ~22 PRs reales**: 7 decisión-dueño + 10 mergeable-candidato (verificar checks/conflictos) + 5 duda. | **~2–4 h** | Mergea el valor real: 320/323 (ISOFRIG PIR pricing), 287 (golden-price-guard), 349/330 (auth realtime), 290/182 (deploy/secrets). Resuelve lo bloqueante de pricing/seguridad. |
| 3 | **Construir Fase A acotada SOLO al gap** (no re-implementar lo existente): ruta **`/version`** que consolide `gitSha`+`CALCULATOR_DATA_VERSION`+`built_at`, y **`scripts/reconcile-version.mjs`** (net-new) que compare prod `/version` vs git HEAD vs local. | **~1–2 h** | Da el cimiento de drift-detection de la capa viva sin duplicar `/capabilities`, el SHA-embed (`Dockerfile`+`deploy-calc-api.yml`) ni el `presupOrchestrator` ya construido. Conecta con issue #359. |

---

## VEREDICTO
**Fase A NO es trabajo nuevo de cero: ~⅓ ya está (SHA-embed ships, `/capabilities` expone `gitSha`); el único gap real es un `/version` dedicado + un reconciler de versión prod-vs-git-vs-local.**

---

## Prueba de ejecución READ-ONLY
Baseline capturado al inicio y revalidado antes de escribir este reporte — **árbol limpio, cero cambios trackeados, cero commits, cero mutaciones de PR/issue/infra**:

```text
$ git status
On branch claude/beautiful-bohr-gywjnu
nothing to commit, working tree clean

$ git rev-parse --abbrev-ref HEAD
claude/beautiful-bohr-gywjnu

$ git log -1 --oneline
f41d68a feat(pdf): adopt R3-C as primary BMC-theme (#372)
```

El **único** delta de filesystem de este run es este propio archivo `RECON-ORQUESTACION.md` (untracked, el entregable). No se modificó ningún archivo trackeado, no se hizo `git add/commit/push`, y no se ejecutó ningún comando de escritura sobre PRs, issues, Supabase, Cloud Run ni Vercel. (Salida `git status` post-escritura embebida al final del mensaje de entrega.)
