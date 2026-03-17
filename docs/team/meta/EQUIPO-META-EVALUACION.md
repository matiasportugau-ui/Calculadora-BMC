# Equipo BMC/Panelin — Meta-evaluación

**Fecha:** 2025-03-15  
**Objetivo:** Re-evaluar orquestación, configuración de skills y necesidades de nuevos miembros tras full team run.

---

## 1. Overlaps (responsabilidades duplicadas)

| Grupo | Skills involucrados | Descripción del overlap | Recomendación |
|-------|--------------------|-------------------------|---------------|
| **Audit / diagnóstico** | `bmc-dashboard-audit-runner`, `super-agente-bmc-dashboard`, `cloudrun-diagnostics-reporter`, `bmc-dashboard-debug-reviewer` | `audit-runner` usa `run_audit.sh` de `super-agente`; ambos hacen auditoría del dashboard. `cloudrun-diagnostics` es solo Cloud Run (panelin-calc). `debug-reviewer` es post-audit. | Mantener cadena: `super-agente` (base) → `audit-runner` (orquestado) → `debug-reviewer`. Documentar que `cloudrun-diagnostics` es solo Cloud Run y no sustituye al audit local. |
| **Mapping Sheets** | `bmc-planilla-dashboard-mapper`, `google-sheets-mapping-agent` | `planilla-mapper` usa `google-sheets-mapping-agent` para inventario y GET/PUSH. Hay solapamiento en inventario y estructura de sheets. | Mantener: `planilla-mapper` orquesta; `google-sheets-mapping-agent` es subskill. Aclarar en `planilla-mapper` que delega en `google-sheets-mapping-agent`. |
| **GPT / Cloud** | `panelin-gpt-cloud-system`, `openai-gpt-builder-integration`, `panelin-drift-risk-closure` | Los tres trabajan GPT + Cloud. `gpt-cloud-system` = operación continua; `gpt-builder-integration` = configuración inicial; `drift-risk-closure` = cierre de drift. | Definir orden: `gpt-builder-integration` (setup) → `panelin-gpt-cloud-system` (operación) → `drift-risk-closure` (cuando hay drift). Añadir referencias cruzadas en cada SKILL. |
| **Hosting / infra** | `networks-development-agent`, `bmc-dashboard-netuy-hosting` | `networks` cubre hosting en general; `netuy-hosting` es específico para VPS Netuy. | Mantener: `networks` para análisis y migración; `netuy-hosting` para deploy en Netuy. En `networks` añadir: "Para deploy Netuy, usar bmc-dashboard-netuy-hosting". |

---

## 2. Gaps (áreas sin skill dedicado)

| Área | Contenido | Skill actual | Gap |
|------|-----------|--------------|-----|
| **Ventas 2.0** | Sección dashboard (placeholder) | Ninguno | No hay skill para diseño/implementación de Ventas 2.0. |
| **Invoque Panelin** | Sección dashboard (placeholder) | Ninguno | No hay skill para integración Invoque ↔ dashboard. |
| **Apps Script / Code.gs** | Automatizaciones, DialogEntregas, triggers | Solo referenciado en `bmc-dashboard-one-click-setup` | Falta skill para edición y mantenimiento de Apps Script. |
| **Mercado Libre** | OAuth, preguntas, integración | `browser-agent-orchestration` (verificación OAuth) | No hay skill equivalente a `shopify-integration-v4` para ML. |
| **Version / Changelog** | Bump, changelog, release notes | `version-evolution-writer` (Codex) | Existe en Codex pero no está en el equipo BMC ni en PROJECT-TEAM-FULL-COVERAGE. |
| **Tests / QA** | Validación end-to-end, regresión | `expert-debug-autonomous`, `bmc-api-contract-validator` | No hay skill de QA/regresión explícito. |
| **Documentación técnica** | Docs de arquitectura, onboarding | Ninguno | No hay skill para mantener docs técnicos y onboarding. |

---

## 3. Mejoras en orquestación

### 3.1 Orquestador vs equipo completo

El orquestador (`bmc-dashboard-team-orchestrator`) define este orden:

```
0. Read PROJECT-STATE
1. Plan & proposal
2. Planilla & Dashboard Mapper
3. Dependencies & Service Mapper
4. Dashboard Designer
5. Implementation Plan & Reporter
6. Update PROJECT-STATE
```

**Roles que no están en el full run:**

- **Fiscal** (bmc-dgi-impositivo): mencionado como "fiscaliza operaciones" pero sin paso explícito.
- **Billing** (billing-error-review): no integrado.
- **Audit** (audit-runner, debug-reviewer): no integrado.
- **Contract** (bmc-api-contract-validator): no integrado.
- **Calc** (bmc-calculadora-specialist): no integrado.
- **Security** (bmc-security-reviewer): no integrado.
- **Networks** (networks-development-agent): no integrado.
- **Integrations** (shopify, browser-agent): no integrados.

### 3.2 Dependencias y handoffs faltantes

| Handoff faltante | De | A | Acción sugerida |
|------------------|----|---|-----------------|
| Contract → Mapping | bmc-api-contract-validator | bmc-planilla-dashboard-mapper | Si hay drift, notificar a Mapping para actualizar contrato. |
| Audit → Reporter | bmc-dashboard-debug-reviewer | bmc-implementation-plan-reporter | Incluir hallazgos de audit en el plan de implementación. |
| Security → Orchestrator | bmc-security-reviewer | Orquestador | Añadir paso pre-deploy: "Security review". |
| Calc → Mapping | bmc-calculadora-specialist | bmc-planilla-dashboard-mapper | Ya existe; asegurar que esté en el orquestador. |
| Integrations → Networks | shopify-integration-v4 | networks-development-agent | Cambios en webhooks/URLs → notificar a Networks. |

### 3.3 Orden sugerido para full run extendido

```
0. Read PROJECT-STATE
1. Plan & proposal
2. Planilla & Dashboard Mapper
3. Dependencies & Service Mapper
4. [NUEVO] Contract Validator (pre-check)
5. Dashboard Designer
6. [NUEVO] Security Review (pre-deploy)
7. Implementation Plan & Reporter
8. Update PROJECT-STATE
```

**Runs especiales** (fuera del full run estándar):

- **Audit run:** `super-agente` → `audit-runner` → `debug-reviewer`.
- **Sync run:** `bmc-project-team-sync` (lee estado, propaga, actualiza).
- **GPT run:** `gpt-builder-integration` o `panelin-gpt-cloud-system` según fase.

---

## 4. Skills que necesitan mejor configuración

| Skill | Problema | Mejora sugerida |
|-------|----------|------------------|
| **google-sheets-mapping-agent** | No referencia PROJECT-STATE | Añadir: "Antes de trabajar, leer docs/PROJECT-STATE.md si existe." |
| **bmc-dashboard-design-best-practices** | No referencia PROJECT-STATE | Idem. |
| **bmc-dependencies-service-mapper** | No referencia PROJECT-STATE | Idem. |
| **bmc-implementation-plan-reporter** | No referencia PROJECT-STATE | Idem. |
| **bmc-dgi-impositivo** | No referencia propagación | Añadir: "Si detecta error fiscal que afecta datos, notificar a Billing y Mapping (tabla propagación §4)." |
| **billing-error-review** | No referencia propagación | Añadir: "Si hallazgos afectan datos de Sheets, notificar a Mapping." |
| **bmc-dashboard-audit-runner** | No referencia PROJECT-STATE | Añadir: "Al terminar, actualizar PROJECT-STATE si hay hallazgos críticos." |
| **bmc-dashboard-debug-reviewer** | No referencia propagación | Añadir: "Si hallazgos afectan Design/Networks/Mapping, añadir a Pendientes o Log for [Agent]." |
| **networks-development-agent** | No referencia tabla de propagación | Añadir referencia a PROJECT-TEAM-FULL-COVERAGE §4. |
| **shopify-integration-v4** | No referencia PROJECT-STATE | Añadir: "Cambios en webhooks/URLs → notificar a Networks (tabla propagación)." |
| **panelin-gpt-cloud-system** | No referencia PROJECT-STATE | Añadir: "Cambios en OpenAPI/GPT → notificar a Integrations, Design (tabla propagación)." |
| **ai-interactive-team** | Solo Mapping, Design, Networks | Considerar incluir Dependencies y Contract en el protocolo. |

---

## 5. AI Interactive Team y tabla de propagación

### 5.1 AI Interactive Team

- **Miembros actuales:** Mapping, Design, Networks.
- **Faltan:** Dependencies, Contract, Calc, Integrations, Reporter.
- **Propuesta:** Incluir Dependencies y Contract en el protocolo cuando haya cambios que afecten a varios agentes.

### 5.2 Tabla de propagación

- **Definición:** PROJECT-TEAM-FULL-COVERAGE §4.
- **Skills que la referencian:** `bmc-project-team-sync`, `bmc-planilla-dashboard-mapper`, `bmc-api-contract-validator`.
- **Skills que no la referencian:** La mayoría.
- **Propuesta:** Añadir en cada skill que modifica estado: "Consultar tabla de propagación en PROJECT-TEAM-FULL-COVERAGE §4 para notificar a agentes afectados."

---

## 6. Nuevos roles/skills sugeridos

| Rol / Skill | Área | Justificación |
|-------------|------|---------------|
| **bmc-apps-script-editor** | Sheets / Automatización | Code.gs, DialogEntregas, triggers; hoy solo referenciado en one-click-setup. |
| **bmc-ventas-invoque-specialist** | Dashboard | Ventas 2.0 e Invoque Panelin; hoy placeholders sin skill. |
| **bmc-qa-regression** | Tests | Regresión end-to-end, smoke tests; hoy repartido entre debug y contract. |
| **bmc-docs-maintainer** | Documentación | Mantenimiento de docs técnicos, onboarding, arquitectura. |
| **Integración version-evolution-writer** | Release | Ya existe en Codex; integrarlo en el equipo BMC para bumps y changelog. |

---

## 7. Resumen ejecutivo

| Dimensión | Estado | Acciones prioritarias |
|-----------|--------|------------------------|
| **Overlaps** | 4 grupos con solapamiento | Documentar relaciones (audit, mapping, GPT, hosting) y orden de uso. |
| **Gaps** | 7 áreas sin skill | Crear skills para Apps Script, Ventas/Invoque, QA; integrar version-evolution. |
| **Orquestación** | Orquestador incompleto | Incluir Contract y Security en el full run; definir runs especiales (audit, sync, GPT). |
| **Configuración** | ~12 skills sin PROJECT-STATE/propagación | Añadir "leer PROJECT-STATE" y "consultar tabla propagación" donde corresponda. |
| **AI Interactive Team** | 3 miembros | Ampliar a Dependencies y Contract. |
| **Propagación** | Poco usada en skills | Referenciar tabla de propagación en skills que modifican estado. |

---

## 8. Inventario de skills (29)

- **BMC core:** bmc-planilla-dashboard-mapper, google-sheets-mapping-agent, bmc-sheets-structure-editor, bmc-dependencies-service-mapper, bmc-dashboard-design-best-practices, bmc-implementation-plan-reporter, bmc-api-contract-validator, bmc-calculadora-specialist, bmc-security-reviewer.
- **Audit / diagnóstico:** bmc-dashboard-audit-runner, bmc-dashboard-debug-reviewer, super-agente-bmc-dashboard, cloudrun-diagnostics-reporter.
- **Setup / hosting:** bmc-dashboard-one-click-setup, bmc-dashboard-netuy-hosting, networks-development-agent.
- **Integraciones:** shopify-integration-v4, browser-agent-orchestration.
- **GPT / Cloud:** panelin-gpt-cloud-system, openai-gpt-builder-integration, panelin-drift-risk-closure, implement-gpt-operativo-plan, panelin-gpt-artifacts-regenerator.
- **Fiscal / billing:** bmc-dgi-impositivo, billing-error-review.
- **Orquestación:** bmc-project-team-sync, ai-interactive-team.
- **Otros:** expert-debug-autonomous, drive-space-optimizer, panelin-live-editor, panelin-repo-solution-miner.
