# PR Cleanup Auto-mode Report — 2026-05-11

**Sesión:** Auto-mode autonomous (Matías away). Continuación de `docs/team/PENDIENTES-AUDIT.md`.

**Scope:** PRs entre 7-30 días de antigüedad (18 PRs). Se procesaron autónomamente los casos claros (superseded, duplicados, mismo bug ya resuelto) y se difirieron los que requieren juicio humano.

---

## Resultado neto

| Métrica | Antes (sesión completa) | Ahora |
|---|---:|---:|
| Total PRs abiertos | 74 | **57** |
| PRs ≥30d | 9 | **0** ✓ |
| PRs 7-30d | 18 | **9** (deferred) |
| PRs <7d | 47 | 48 |

**Cerrados en auto-mode (9 PRs):** #65, #66, #89, #91, #95, #104, #113, #114, #115.
**Deferred — requieren tu decisión (9 PRs):** #62, #70, #71, #81, #84, #100, #105, #106, #112.

---

## Cerrados (9 PRs)

| # | Título | Razón |
|---:|---|---|
| #65 | ci: fix npm ci on Ubuntu (ALSA headers for easymidi/midi) | `easymidi` ya NO está en `package.json`. Causa raíz quitada. CI 2026-05-11 verde sin esto. |
| #66 | Add cloud agent repo starter skill | Per regla H1 vision_meta = metawork (Cursor skill mecánico). Mismo patrón que #38 CEO Agent. |
| #89 | release: integration 2026-04-22 (#76 deps + #83 chatbot) | Release train superseded — PR #76 y #83 ambos MERGED en main hace 18 días. |
| #91 | feat: JSON files for Admin/CRM/KB/Matriz | 100% superseded — todos los JSONs ya en `.accessible-base/` en main. |
| #95 | docs(state): update PROJECT-STATE towards deployment | PROJECT-STATE.md tiene "Última actualización 2026-05-09" — 100 archivos / +19676 LOC del PR superseded. |
| #104 | chore(calc): rename _backup → canonical | **Viola convención** — CLAUDE.md línea 52: "do not refactor away from this naming". |
| #113 | fix(ci): remove accidental Claude worktree gitlink | Duplicado #114/#115. Problema ya resuelto: `.gitignore` línea 60 contiene `.claude/worktrees/`. |
| #114 | fix(ci): remove accidental Claude worktree gitlink | Duplicado. Problema ya resuelto. |
| #115 | fix(ci): remove accidental worktree gitlink | Duplicado. Problema ya resuelto. |

Todas las ramas remotas borradas. Cada cierre con comentario citando `docs/team/PENDIENTES-AUDIT.md`.

---

## Deferred — requieren tu decisión humana (9 PRs)

### Alto valor — H1, recomendación: **rebasear + revisar + mergear**

#### **#106 — security: cerrar gaps OAuth/webhook + migrar secrets a GSM** (11d, DRAFT)
- **Estado:** archivos NUEVOS (`server/lib/mlSignature.js`, `tests/mlSignature.test.js`, `docs/team/SECURITY-HARDENING-REPORT-202604.md`) — NO existen en main
- **Toca:** ML Webhook HMAC + OAuth + secrets a Google Secret Manager
- **H1:** alto (security hardening de canales que generan leads)
- **Recomendación:** **REBASEAR + REVIEW + MERGE**. Es feature legítima, no metawork. Body cita "auditoría 29-abr-2026" — propósito sigue vigente.
- **Riesgo:** medio. 11 días no es mucho; los archivos son net additive (no toca código existente principalmente).

#### **#70 — Panelin chat: contexto operativo CRM/ML en el servidor** (26d, DRAFT)
- **Estado:** `server/lib/agentOpsContext.js` NO existe en main (archivo nuevo)
- **Toca:** chat Panelin (`agentChat.js`, `chatPrompts.js`, `bmcDashboard.js`, +tests)
- **H1:** **muy alto** — chat Panelin = exactamente tu cuello de botella ("cerrar leads sin Matías")
- **Recomendación:** **REBASEAR + REVIEW + MERGE**. Feature directa H1.
- **Riesgo:** medio-alto. 26d en chat module que evolucionó mucho. Conflictos probables en `agentChat.js`.

### Valor mixto — requieren análisis profundo

#### **#81 — fix: pricing anomalies + SKU dupes + security gaps** (22d, DRAFT)
- **Estado:** **PARCIALMENTE superseded**. `src/utils/budgetLog.js` SÍ existe en main; `ErrorBoundary.jsx` y `CORS_ORIGINS` NO.
- **Toca:** core (calc.js, App.jsx, constants.js)
- **Body:** lista BUG-05 (SKU duplicados ISODEC_PIR/ISOWALL), BUG-06 (pricing anomalies web<venta), CQ-03 (PDF dimensions), security CORS_ORIGINS
- **Recomendación:** **REVIEW manual** — ¿BUG-05 y BUG-06 ya están arreglados por otra vía? Verificar antes de mergear. Posible cherry-pick parcial.
- **Riesgo:** medio. Toca código core de calc/constants.

#### **#100 — hub/admin: full-column live grid + Agent Admin model routing** (11d, DRAFT)
- **Estado:** `server/lib/modelRouter.js` NO existe en main
- **Toca:** Agent Admin module + model routing por task + Wolfboard
- **H1:** medio (Agent Admin tooling para tu trabajo, no para el cliente)
- **Recomendación:** **REVIEW** — bot author (`copilot-swe-agent`), 1261 LOC adds. Verificar que el feature alinee con dirección actual de Agent Admin.

### Bajo valor / metawork

#### **#62 — Claude/live calculator editing beqxk** (28d, READY)
- **Estado:** introduce `docs/audit/`, `docs/VISION.md`, `.codex/config.toml` — NO existen en main
- **Body:** "spec-driven, multi-agent development approach", 30 archivos, mostly docs + config
- **Per regla H1 vision_meta:** metawork. No mueve métrica norte.
- **Recomendación:** **CLOSE** (decisión filosófica — confirmar). Si querés un audit master plan, conviene escribirlo desde realidad actual del repo, no rebasear branch de hace 28d.

#### **#71 — BMC Connect iOS: static PWA folder + Vercel deploy** (26d, DRAFT)
- **Estado:** `bmc-connect-ios/` NO existe en main
- **Body:** PWA iOS demo + script deploy
- **Pregunta estratégica:** ¿BMC Connect iOS es producto activo del roadmap o experimento descartado?
- **Recomendación:** **TU DECISIÓN** — si el producto sigue vivo, mergear; si fue prueba, close.

#### **#84 — feat(roof/qa): encuentros, estructura UX, data-testid** (19d, DRAFT)
- **Estado:** feature en progreso (calculo-especialist territory)
- **Toca:** RoofPreview.jsx, roofEncounterModel.js, scenarioOrchestrator.js
- **Recomendación:** **REVIEW del calculo-especialist agent**. El draft tiene cambios significativos a UX del plano. No autonomous-decidible.

### Bloqueos técnicos

#### **#112 — test: cover ML ETL run routes** (7d, DRAFT, **CONFLICTING**)
- **Estado:** `tests/ml-etl-run-routes.test.js` NO existe en main → aporta valor
- **Bloqueo:** DRAFT + CONFLICTING + REVIEW_REQUIRED. No auto-mergeable.
- **Recomendación:** **REBASEAR conflictos + promover a ready + MERGE**. Tests son net additive, low risk. Vale el esfuerzo.

#### **#105 — chore: dev-trace + audit docs + infrastructure (mega +193k LOC)** (11d, READY, **CONFLICTING**)
- **Estado:** **MEGA-PR** — 193,134 adds / 11,508 dels. Imposible revisar tal cual.
- **Recomendación:** **Acción 4** (sesión propia). Opciones:
  1. **Split** en 5-10 PRs atómicos por área (dev-trace / audit / infra)
  2. **CLOSE + reescribir** incrementalmente
  3. Revisar el `git diff` para ver qué tan vivo está el contenido
- **NO auto-decidible** — decisión arquitectónica.

---

## Próximos pasos sugeridos cuando vuelvas

**Prioridad alta (ataca H1):**
1. Rebasear y mergear **#106** (security gaps) — código nuevo, propósito vigente
2. Rebasear y mergear **#70** (Panelin chat ops context) — toca H1 directo

**Prioridad media:**
3. Decidir **#81** (parcialmente superseded) — cherry-pick fixes que falten o close
4. Decidir **#84** (roof feature) — invocar calculo-especialist
5. Rebasear **#112** (tests ML ETL) — fácil, valor medio
6. Decidir **#100** (hub admin grid) — review de scope

**Decisiones estratégicas:**
7. **#71** — ¿BMC Connect iOS sigue en roadmap?
8. **#62** — close (per H1) o decidir si meta-doc tiene valor

**Sesión propia:**
9. **#105** — Acción 4 del plan original. Sesión 4-6 hs.

---

## Validación per `project_vision_meta.md`

- ✅ Regla 1 (validar contra Cuello de botella): cada DEFER marca explícitamente impacto H1
- ✅ Regla 2 (postergar si no acelera ingresos en 90d): #62 y #66 marcados como metawork
- ✅ Capa 0 (no hay "llegué"): este reporte explícitamente NO declara cleanup completo — quedan 9 PRs deferred + 48 PRs <7d que entrarán en próxima ola

## Cambios al estado del repo

- 9 PRs cerrados, 9 ramas remotas borradas
- Comentario de cada cierre cita `docs/team/PENDIENTES-AUDIT.md` para trazabilidad
- Métricas finales: 74 PRs → 57 abiertos · ≥30d: 9 → 0 ✓
