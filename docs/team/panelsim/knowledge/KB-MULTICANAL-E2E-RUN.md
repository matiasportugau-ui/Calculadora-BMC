# KB Multi-canal — End-to-End Run

> **Función de este documento:** definir la **única** run que estamos ejecutando. Todo lo que no encaja acá se parquea en `KB-MULTICANAL-PARKING-LOT.md` y se retoma después. Si algo pretende salirse, **avisar antes** de actuar.

---

## Objetivo único de la run

Llevar la iniciativa **KB multi-canal y Admin** desde su estado actual (campos `goodAnswerML/goodAnswerWA` muertos en el shape, `suggest-response` sin retrieval, Admin sin cobertura WA) hasta **producción operando** con:

1. Resolver multi-superficie en uso real.
2. Chat Panelin y `/crm/suggest-response` cableados con KB resuelta por canal.
3. Admin mostrando cobertura por canal con CTA Auto-ML/Auto-WA.
4. Doc operativa publicada.
5. Migración a Vercel AI Gateway de los endpoints CRM (Fase 3 separada pero parte de la misma run).

**Fuente de verdad del diseño:** [`KB-MULTICANAL-DESIGN-V2.md`](./KB-MULTICANAL-DESIGN-V2.md).
**Plan operativo:** [`.cursor/plans/kb_multi-canal_y_admin_e4f12975.plan.md`](../../../../../.cursor/plans/kb_multi-canal_y_admin_e4f12975.plan.md).

---

## Definition of Done (DoD) — éxito completo de la run

La run se considera **completa y exitosa** cuando se cumplen todos estos criterios. Cualquier criterio en rojo bloquea cierre.

| # | Criterio | Verificación |
|---|----------|--------------|
| D1 | `resolveTrainingAnswer(entry, surface)` exportado desde `server/lib/trainingKB.js` con fallback a legacy. | `grep` + tests passing |
| D2 | `tests/kbSurfaceResolve.test.js` con los 5 casos del Brief §6.3, todos verdes. | `npm test` |
| D3 | `agentChat.js` acepta `surface` opcional y mapea ejemplos antes de `buildSystemPrompt`. Default `panelin_chat`. | Test SSE de regresión |
| D4 | `bmcDashboard.js /crm/suggest-response` invoca `findRelevantExamples` + `resolveTrainingAnswer` con `mapOrigenToSurface`. Bloque KB con `matchScore >= 2`, `limit: 3`. | Test integración + smoke en CRM real |
| D5 | `agentTraining.js` expone `GET /agent/training-kb/analytics` con `byCategory`, `bySurface { mercado_libre, whatsapp }`, `retrievalTrend`, `topQueries`, `conflicts`. | `curl` smoke |
| D6 | `AgentAdminModule.jsx` muestra matriz de cobertura por canal con `recharts` + botón Auto-WA simétrico al Auto-ML. | Visual review en localhost + screenshot |
| D7 | `docs/team/panelsim/knowledge/KB-MULTICANAL-OPERATIVA.md` publicado con matriz superficie↔prompt↔campo y checklist de envs. | Archivo existe y linkea desde `ML-TRAINING-SYSTEM.md` |
| D8 | `/crm/suggest-response` y `/crm/parse-email` migrados a Vercel AI Gateway (auth OIDC). 4 secretos `*_API_KEY` retirados. | Diff de líneas + envs en Cloud Run |
| D9 | `npm run gate:local:full` (lint + test + build) pasa. | CI verde |
| D10 | Deploy a Cloud Run + Vercel sin regresión en chat Panelin existente. | Smoke tests post-deploy |
| D11 | KB con al menos 5 entries que tengan override `mercado_libre` y 5 con `whatsapp` (poblado vía Auto-ML/Auto-WA). | Stats Admin + KB Score ≥ 80 |

**Estado actual (2026-05-08):**

| DoD | Estado | Dónde vive |
|-----|--------|------------|
| D1 — `resolveTrainingAnswer` exportado | ✅ EN MAIN | PR #186 mergeado (commit `5f6dfb1`) |
| D2 — `tests/kbSurfaceResolve.test.js` 5 casos green | ✅ EN MAIN | 78 asserts (52 base + 26 mapOrigenToSurface) |
| D3 — `agentChat.js` acepta `surface` | 🟡 PR #187 OPEN | branch `feat/kb-multicanal-f32-remaining` |
| D4 — `/crm/suggest-response` con KB block | 🟡 PR #187 OPEN | mismo PR |
| D5 — `GET /agent/training-kb/analytics` | 🟡 PR #188 OPEN | branch `feat/kb-multicanal-f4-analytics`, 94 asserts green, fixes UTC midnight de Copilot review aplicados |
| D6 — Admin UI matriz cobertura + Auto-WA | ❌ PENDING | F5 — próxima fase a arrancar |
| D7 — `KB-MULTICANAL-OPERATIVA.md` publicado | ❌ PENDING | F6 |
| D8 — Endpoints CRM migrados a AI Gateway | 🟡 PR #187 OPEN | helper `aiGatewayClient.js` + 3 endpoints. Auth OIDC + fallback legacy preservado |
| D9 — `npm run gate:local:full` verde | ⚠️ PARCIAL | drift pre-existente en `agentTools / toolStats / userIntentClassifier` (28 vs 30 tools), parqueado y ajeno a esta run |
| D10 — Deploy Cloud Run + Vercel sin regresión | ❌ PENDING | tras merge de #187 + #188 |
| D11 — KB con ≥5 entries override ML y ≥5 WA | ❌ PENDING | F7 — Auto-ML/Auto-WA en producción |

**PRs abiertos pendientes de merge:**
- **#187** — F2 + F3.1 + F3.2 (chat surface, suggest-response KB block, AI Gateway en 4 endpoints).
- **#188** — F4 (analytics endpoint + helpers de cobertura por canal).

**Side-effects observados:**
- Branch `feat/kb-multicanal-f4-analytics` recibió un commit ajeno (`bb834de feat(driveClient)`, autor `matiasportugau-ui`) de otro workflow. No es destructivo pero se cuela en el changelog de PR #188.
- PR #189 (`goldens runner`) se mergeó a main de forma independiente — no impacta esta run.
- Copilot review aplicó 3 fixes legítimos a F4 (UTC midnight snap, `MS_PER_DAY` constant) — adoptados.

---

## Fases (en orden de ejecución)

| Fase | Alcance | DoD parcial | Riesgo |
|------|---------|-------------|--------|
| **F1 — Resolver + tests** | `kbSurface.js`, `resolveTrainingAnswer`, 5 tests | D1, D2 | Bajo — aditivo |
| **F2 — Cableado chat** | `agentChat.js` acepta `surface` y mapea | D3 | Bajo — default seguro |
| **F3 — Cableado suggest-response + AI Gateway** | KB injection en CRM + migración a AI Gateway | D4, D8 | Medio — cambia comportamiento productivo |
| **F4 — Endpoint analytics** | `GET /agent/training-kb/analytics` | D5 | Bajo |
| **F5 — UI Admin cobertura** | Matriz `recharts` + Auto-WA | D6 | Bajo |
| **F6 — Doc operativa** | `KB-MULTICANAL-OPERATIVA.md` | D7 | Cero |
| **F7 — Poblado de variantes** | Run Auto-ML + Auto-WA en producción, revisar y aprobar | D11 | Bajo |
| **F8 — Deploy + smoke** | Gate local full + deploy + verificación | D9, D10 | Medio (se rolea atrás si falla) |

**F1 y F2 son secuenciales.** F3 puede arrancar en paralelo con F4 + F5 después de F1.

---

## Reglas operativas (durante la run)

1. **Toda sugerencia se evalúa contra esta DoD primero.**
   - ¿Aporta a D1-D11? → entra en la fase correspondiente.
   - ¿No aporta? → va al **Parking Lot** con justificación.
   - ¿Aporta pero extiende scope? → **avisar** antes de actuar y pedir confirmación.

2. **Divergencias se anuncian explícitamente.**
   Si durante la implementación detecto que algo se sale del DoD (refactor tentador, "approvechamos para…", librería nueva no auditada en el brief), corto y aviso con formato:
   > 🚨 DIVERGENCIA — propuesta: <X>. No está en DoD. Opciones: (a) parquear, (b) extender scope con tu OK, (c) descartar.

3. **El Parking Lot es ley.**
   Cada idea desviada se escribe inmediatamente en `KB-MULTICANAL-PARKING-LOT.md` con: título, área de desarrollo, motivación, esfuerzo estimado, archivo/línea de entrada, fase original donde apareció. Sin excepciones.

4. **Cero refactor oportunista en archivos del DoD.**
   Si toco `agentChat.js` para F2, **sólo** toco las líneas de F2. Cualquier limpieza adicional al archivo va al Parking Lot.

5. **Cero archivos nuevos fuera de los planificados.**
   Los nuevos archivos previstos son: `server/lib/kbSurface.js`, `tests/kbSurfaceResolve.test.js`, `docs/team/panelsim/knowledge/KB-MULTICANAL-OPERATIVA.md`. Cualquier otro archivo nuevo requiere aprobación.

6. **Tests primero en F1.** Escribir `tests/kbSurfaceResolve.test.js` antes de `kbSurface.js`. Ya tenemos los 5 casos definidos.

7. **Smoke real antes de cerrar fase.** Cada fase termina con un smoke test concreto, no solo unit tests.

8. **Commits atómicos por fase.** Un commit por fase con prefijo `feat(kb-surface): F<n> — <descripción>`. Facilita rollback granular.

---

## Anti-patterns a evitar (lecciones del brief)

- ❌ Tocar `buildSystemPrompt` para meter el resolver. **El resolver vive en el caller** (Brief §1, archivo 2).
- ❌ Migrar `agentChat.js` a Vercel AI Gateway en F3. **Diferido a Fase 4 separada** por riesgo SSE custom (Brief §5.3).
- ❌ Instalar `langchain` para retrieval. Inspirarse, no instalar (Brief §4).
- ❌ Usar BGE-reranker local. **Incompatible con transformers.js en Cloud Run Node** (Brief §3.5).
- ❌ Tocar `data/knowledge/*.md` para diferenciar canales. **Esos son hechos canónicos**; las variantes viven en `training-kb.json` (Brief §1, archivo 7).

---

## Métricas de éxito post-deploy

A medir 7 días después del deploy de F8:

- **Adopción:** % de turnos en chat Panelin con `surface != panelin_chat` (cuando wolfboard u otros canales empiecen a llamar).
- **Cobertura:** % de entries activas con override `mercado_libre` (objetivo > 60% en categoría Sales).
- **Calidad:** % de respuestas en `/crm/suggest-response` con bloque KB inyectado (objetivo > 30% — el resto cae al threshold).
- **Costo:** tokens input mensuales tras prompt caching (objetivo -40% mínimo).
- **Latencia:** p95 de `/crm/suggest-response` (objetivo: no degradar > 100 ms vs baseline pre-AI Gateway).

---

## Salida de emergencia

Si en cualquier fase aparece un blocker que no se resuelve en 1 sesión:
1. Documentar el blocker en el Parking Lot con tag `BLOCKER`.
2. Hacer rollback al último commit de fase verde.
3. Avisar al usuario con propuesta de pivot o pausa.

Si Vercel AI Gateway falla en producción tras F3:
1. Revertir el commit de migración (el código BYOK con SDKs directos sigue compilando si lo dejamos como `legacyProviderClients.js` archivado).
2. Re-activar las 4 envs `*_API_KEY` originales (siguen en Secret Manager hasta retirarlas oficialmente en F8).
3. Investigar offline.

---

## Próximo paso confirmado

**Fase 1 — Resolver + tests.** Empezar por `tests/kbSurfaceResolve.test.js` (TDD).
