# Plan maestro — Auditoría spec-driven / multi-agent (2026-04-13)

## Propósito

Este documento fija el **modo PLAN FIRST** para la evolución del workspace **Calculadora-BMC** hacia un sistema **spec-driven / multi-agent** de nivel 2026, con **trazabilidad evidencia → hallazgo → recomendación → plan**. La auditoría de hecho ya se ejecutó en esta sesión; los entregables viven bajo `docs/audit/` y el resumen máquina en `docs/audit/audit-summary.json`.

## Alcance y límites

- **Incluye:** inventario técnico, estado repo, estado prod **verificado por smoke**, evaluación de madurez spec-driven, brechas, plan por fases, playbook de extracción local.
- **No incluye (sin evidencia directa):** variables reales de Vercel/Cloud Run en consola, reglas de branch protection en GitHub, tráfico real del SPA en `calculadora-bmc.vercel.app` (marcar **No verificado** en entregables).
- **Sin refactors amplios** ni cambios de negocio en esta fase — solo documentación y JSON de auditoría.

## Entregables (canon de esta corrida)

| Archivo | Rol |
|---------|-----|
| `docs/audit/01-system-inventory.md` | Inventario técnico con tabla y findings |
| `docs/audit/02-production-local-state.md` | Local vs prod, evidencia de smoke, #ZonaDesconocida |
| `docs/audit/03-spec-driven-assessment.md` | Niveles 0–5, veredicto **Nivel 2 (+ parcial 3)** |
| `docs/audit/04-gap-analysis-2026.md` | Brechas vs prácticas 2026 priorizadas |
| `docs/audit/05-master-implementation-plan.md` | Fases, criterios, riesgos, quick wins |
| `docs/audit/06-local-extraction-playbook.md` | Comandos reproducibles para próxima auditoría |
| `docs/audit/audit-summary.json` | Input para automatización (schema acordado) |

## Hallazgo ejecutivo #1 (bloqueante de confianza)

**Drift de `public_base_url`:** `npm run smoke:prod -- --json` mostró el check `public_base_url` con **`ok: false`** mientras el run global **`ok: true`**. En código, `scripts/smoke-prod-api.mjs` **no marca** `criticalFail` ante mismatch (alerta solamente). **Implicación:** el pipeline puede estar “verde” con **URLs divergentes** — incompatible con nivel 4–5 de spec enforcement.

## Secuencia recomendada de implementación (resumen)

1. **Phase 0 — Autoridad de hosts:** una URL canónica; alinear `PUBLIC_BASE_URL`, default de smoke, OpenAPI `servers`, manifest.
2. **Phase 1 — CI en capas:** gates determinísticos en PR vs smoke prod programado.
3. **Phase 2 — Perfiles de contrato:** `strict` vs `degraded`; eliminar passes silenciosos por 404 donde no corresponda.
4. **Phase 3 — Registro de rutas SSOT** entre `bmcDashboard.js` y `agentCapabilitiesManifest.js`.
5. **Phase 4+ — Schema/types** en borde `/calc/*` y validación de artefactos multi-agente (JSON Schema).

Detalle: **`docs/audit/05-master-implementation-plan.md`**.

## Supuestos (#ZonaDesconocida)

- Se asume que el **servicio Cloud Run** probado por smoke (`642127786762…`) es el mismo plano funcional que el host declarado en `public_base_url` (`q74zutv7dq…`) salvo **config de env** — no se verificó DNS/revision routing interno de GCP en esta sesión.
- No se leyó el contenido de **`.env`** local (secretos).

## Cómo re-ejecutar la auditoría

Seguir **`docs/audit/06-local-extraction-playbook.md`**.

## Trazabilidad (evidencia clave usada)

- `package.json`, `vite.config.js`, `server/index.js`, `server/config.js`
- `.github/workflows/ci.yml`, `deploy-calc-api.yml`, `deploy-frontend.yml`
- `scripts/smoke-prod-api.mjs` (incl. ramas `public_base_url` / `criticalFail`)
- `scripts/validate-api-contracts.js`, `eslint.config.js`
- `docs/openapi-calc.yaml`, `server/agentCapabilitiesManifest.js`
- Salida real: `npm run smoke:prod -- --json` (2026-04-13)
- `git status -sb` en rama `claude/live-calculator-editing-Beqxk`

## Estado de este plan

- **Estado:** completado (documentación generada en repo).
- **Próximo paso sugerido:** ver `recommended_next_step` en `docs/audit/audit-summary.json`.
