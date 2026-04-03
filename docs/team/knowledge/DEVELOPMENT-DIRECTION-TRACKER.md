# Development Direction Tracker — 2026-04-03

Generated at: 2026-04-03T09:26:24.616Z

## How To Use

- Update only: `status`, `owner`, `dueDate`, `nextStep`, `evidence`, `notes` in `development-direction-tracker.json`.
- Re-run `npm run knowledge:direction` (or `knowledge:run`) to refresh priorities without losing manual tracking fields.
- Status values: `todo`, `in_progress`, `blocked`, `done`.

## Summary

- Total items: 12
- High: 11
- Medium: 1
- Low: 0
- Done: 0
- In progress: 0
- Blocked: 0

## High Priority

1. [todo] **Review target: docs/openapi-email-gpt.yaml**
   - target: `docs/openapi-email-gpt.yaml`
   - owner: Matias + AI
   - due: 2026-04-04
   - reason: 25 impact hits (2H/12M/11L)
   - recommendation: Review prompt/actions contracts and capability manifests.
   - next: Comparar spec con rutas reales y listar operationIds faltantes.
   - evidence: PR diff + smoke GPT actions
2. [todo] **Review target: scripts/capabilities-snapshot.mjs**
   - target: `scripts/capabilities-snapshot.mjs`
   - owner: AI
   - due: 2026-04-04
   - reason: 25 impact hits (2H/12M/11L)
   - recommendation: Review prompt/actions contracts and capability manifests.
   - next: Regenerar snapshot y validar que no haya drift con /capabilities.
   - evidence: Snapshot generado + salida comando
3. [todo] **Review target: server/gptActions.js**
   - target: `server/gptActions.js`
   - owner: Matias + AI
   - due: 2026-04-05
   - reason: 25 impact hits (2H/12M/11L)
   - recommendation: Review prompt/actions contracts and capability manifests.
   - next: Alinear handlers con OpenAPI y validar errores 4xx/5xx.
   - evidence: Tests/contratos + ejemplos curl
4. [todo] **Review target: server/index.js**
   - target: `server/index.js`
   - owner: AI
   - due: 2026-04-05
   - reason: 25 impact hits (2H/12M/11L)
   - recommendation: Review prompt/actions contracts and capability manifests.
   - next: Verificar wiring de rutas y compatibilidad con capacidades publicas.
   - evidence: Checklist de rutas + health OK
5. [todo] **Review target: Dockerfile.bmc-dashboard**
   - target: `Dockerfile.bmc-dashboard`
   - owner: AI
   - due: 2026-04-06
   - reason: 20 impact hits (5H/2M/13L)
   - recommendation: Validate deploy pipeline and production smoke checks.
   - next: Revisar build args/env y endurecer pasos prebuild para deploy estable.
   - evidence: Build local + nota de cambios
6. [todo] **Review target: scripts/deploy-cloud-run.sh**
   - target: `scripts/deploy-cloud-run.sh`
   - owner: Matias
   - due: 2026-04-06
   - reason: 20 impact hits (5H/2M/13L)
   - recommendation: Validate deploy pipeline and production smoke checks.
   - next: Agregar validaciones previas de env criticas y rollback hint.
   - evidence: Deploy dry-run / output validacion
7. [todo] **Review target: scripts/deploy-vercel.sh**
   - target: `scripts/deploy-vercel.sh`
   - owner: Matias
   - due: 2026-04-07
   - reason: 20 impact hits (5H/2M/13L)
   - recommendation: Validate deploy pipeline and production smoke checks.
   - next: Confirmar variables obligatorias y smoke post-deploy.
   - evidence: URL deploy + smoke OK
8. [todo] **Review target: scripts/smoke-prod-api.mjs**
   - target: `scripts/smoke-prod-api.mjs`
   - owner: AI
   - due: 2026-04-07
   - reason: 20 impact hits (5H/2M/13L)
   - recommendation: Validate deploy pipeline and production smoke checks.
   - next: Priorizar chequeos criticos y salida JSON accionable para CI.
   - evidence: Reporte smoke con checks criticos
9. [todo] **Domain watch: llm-platforms**
   - target: `(cross-cutting)`
   - owner: Matias + AI
   - due: 2026-04-08
   - reason: 25 mappings (2H/12M/11L)
   - recommendation: Promote top mapping recommendations into sprint backlog and validate contracts.
   - next: Definir backlog de compatibilidad LLM/API para esta semana.
   - evidence: Top 3 tareas creadas en tracker
10. [todo] **Domain watch: deployment-stack**
   - target: `(cross-cutting)`
   - owner: Matias + AI
   - due: 2026-04-08
   - reason: 20 mappings (5H/2M/13L)
   - recommendation: Promote top mapping recommendations into sprint backlog and validate contracts.
   - next: Cerrar checklist unica de deploy Cloud Run + Vercel.
   - evidence: Checklist completado
11. [todo] **Domain watch: data-and-storage**
   - target: `(cross-cutting)`
   - owner: AI
   - due: 2026-04-09
   - reason: 9 mappings (6H/2M/1L)
   - recommendation: Promote top mapping recommendations into sprint backlog and validate contracts.
   - next: Revisar migraciones/rutas sensibles y riesgos de compatibilidad.
   - evidence: Informe de riesgo corto

## Medium Priority

1. [todo] **Domain watch: workflow-automation**
   - target: `(cross-cutting)`
   - owner: AI
   - due: 2026-04-10
   - reason: 16 mappings (0H/4M/12L)
   - recommendation: Promote top mapping recommendations into sprint backlog and validate contracts.
   - next: Proponer 2 automatizaciones de alto impacto y bajo esfuerzo.
   - evidence: 2 propuestas priorizadas

## Low Priority

- None

