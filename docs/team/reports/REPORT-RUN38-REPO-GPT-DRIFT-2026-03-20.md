# REPORT — Run 38 (Repos hermanos + GPT drift)

**Fecha:** 2026-03-20

## Repo Sync

- **Calculadora-BMC** (repo actual): main con runs 32–37; rama run36-audit-force disponible para PR.
- **bmc-dashboard-2.0 / bmc-development-team:** Sincronización externa pendiente a criterio de Matias. Artefactos a copiar cuando se ejecute: PROJECT-STATE, PROMPT-FOR-EQUIPO-COMPLETO, RUN-ROADMAP-FORWARD-2026, HANDOFF-ITINERANTE-NEXT-RUN, docs/team (matprompt, reports, judge, adr).

## GPT drift

- **openapi-calc / gpt-entry-point:** Contrato en `docs/openapi-calc.yaml`; `GET /calc/gpt-entry-point` expone `data_version`, `data_version_date` (run data version). Revisar en GPT Builder que las actions apunten al mismo OpenAPI y base URL; si hay drift, actualizar instrucciones o schema URL. Sin acceso a GPT Builder en este run; anotar para Run 38+ cuando se abra sesión.
