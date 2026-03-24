# Judge — Criterios de evaluación por agente

**Propósito:** Entregable individual de cada agente para que el Juez sepa cómo juzgarlo. Cada rol define qué debe entregar y en qué áreas se le evalúa.

---

## Cómo usar este documento

- El Juez lee este documento antes de evaluar.
- Cada agente tiene: **Entregables** (qué debe producir) y **Áreas de ranqueo** (en qué se le evalúa).
- Si un agente no participó en el run, se marca "N/A" y no afecta su promedio histórico.

---

## Mapping (bmc-planilla-dashboard-mapper, google-sheets-mapping-agent)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Completitud** | planilla-inventory.md y planilla-map.md actualizados; todas las tabs y columnas relevantes documentadas |
| **Cross-reference** | DASHBOARD-INTERFACE-MAP alineado con planilla; fuentes de datos por sección identificadas |
| **Actualización** | Cambios en Sheets reflejados en docs en el mismo run o sync |
| **Handoff** | Log for Design/Dependencies cuando hay cambios que los afectan |

**Áreas de ranqueo:** Completitud del mapeo (1–5), Actualización (1–5), Calidad del cross-reference (1–5).

---

## Design (bmc-dashboard-design-best-practices)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **UX/UI** | Propuestas o implementaciones que ahorren tiempo (loading, filtros, feedback) |
| **Jerarquía** | Estructura visual clara; estados loading/error definidos |
| **Time-saving** | Menos clics, escaneo rápido, acciones claras |
| **Handoff** | Log for Mapping si necesita datos nuevos; Log for Reporter si hay decisiones de diseño |

**Áreas de ranqueo:** UX/UI (1–5), Time-saving (1–5), Consistencia con DASHBOARD-FRONT-VISION (1–5).

---

## Sheets Structure (bmc-sheets-structure-editor)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Estructura** | Tabs, dropdowns, filas/columnas creados según spec |
| **Validación** | Data validation correcta; sin errores de fórmula |
| **Documentación** | Cambios documentados en planilla-inventory o planilla-map |

**Áreas de ranqueo:** Completitud (1–5), Calidad estructural (1–5). *Solo se evalúa cuando participa (Matias only).*

---

## Networks (networks-development-agent)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Documentación** | HOSTING-EN-MI-SERVIDOR.md, migration plans, risk checklists actualizados |
| **Endpoints** | Puertos, URLs, CORS documentados; env vars documentadas |
| **Propagación** | Log for Mapping/Design cuando hay cambios de hosting o URLs |

**Áreas de ranqueo:** Documentación (1–5), Cobertura de riesgos (1–5), Propagación (1–5).

---

## Dependencies (bmc-dependencies-service-mapper)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Grafo** | dependencies.md con grafo por módulo; dependencias cruzadas identificadas |
| **Service map** | service-map.md con inventario de servicios, rutas API, puertos |
| **Integration checklist** | Gaps y dependencias condicionales documentados |

**Áreas de ranqueo:** Completitud del grafo (1–5), Service map (1–5), Identificación de gaps (1–5).

---

## Integrations (shopify-integration-v4, browser-agent-orchestration)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **OAuth / webhooks** | Configuración documentada; HMAC, redirects correctos |
| **Sync** | Sheets ↔ integración documentada; flujos claros |
| **Propagación** | Log for Networks cuando hay cambios en webhooks/URLs |

**Áreas de ranqueo:** Funcionalidad (1–5), Documentación (1–5), Propagación (1–5).

---

## GPT/Cloud (panelin-gpt-cloud-system, openai-gpt-builder-integration)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **OpenAPI** | docs/openapi-calc.yaml alineado con runtime |
| **GPT Builder** | Actions, instructions, drift cerrado |
| **Propagación** | Log for Integrations/Design cuando hay cambios en OpenAPI o GPT |

**Áreas de ranqueo:** Alineación OpenAPI (1–5), GPT Builder (1–5), Drift closure (1–5).

---

## Fiscal (bmc-dgi-impositivo)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Fiscalización** | Hallazgos sobre operaciones del equipo; alternativas para economizar |
| **Supervisión PROJECT-STATE** | Fiscaliza según ranking de criticidad (FISCAL-PROTOCOL-STATE-RANKING); controla que no sucedan incumplimientos; si ocurren, comunica a involucrados (Log for [Agent]) para que no pase de nuevo; reporta Crítico/Alto al Orquestador |
| **Reporte** | Comunicación al Orquestador; Log for Billing/Mapping si aplica |
| **Propagación** | Consulta tabla propagación cuando detecta error fiscal |

**Áreas de ranqueo:** Fiscalización (1–5), Reporte (1–5), Propagación (1–5).

---

## Billing (billing-error-review)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Detección** | Errores, duplicados, cierre mensual identificados |
| **Reporte** | Hallazgos documentados; Log for Mapping si afecta datos |
| **Propagación** | Consulta tabla propagación cuando hallazgos afectan Sheets |

**Áreas de ranqueo:** Detección (1–5), Reporte (1–5), Propagación (1–5).

---

## Audit/Debug (bmc-dashboard-audit-runner, cloudrun-diagnostics-reporter)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Cobertura** | Endpoints, logs, estado del sistema auditados |
| **Hallazgos** | Issues identificados con severidad y acciones |
| **PROJECT-STATE** | Actualización de PROJECT-STATE si hay hallazgos críticos |
| **Propagación** | Log for Design/Networks/Mapping según hallazgo |

**Áreas de ranqueo:** Cobertura (1–5), Calidad de hallazgos (1–5), Propagación (1–5).

---

## Reporter (bmc-implementation-plan-reporter)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Reporte** | REPORT-SOLUTION-CODING con status, gaps, risks, handoffs |
| **Implementation plan** | IMPLEMENTATION-PLAN con tareas Solution/Coding, handoff table |
| **Claridad** | Solution y Coding saben qué hacer; orden y dependencias respetados |

**Áreas de ranqueo:** Claridad (1–5), Completitud (1–5), Handoffs (1–5).

---

## Orchestrator (bmc-dashboard-team-orchestrator, ai-interactive-team)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Inclusión** | Todos los miembros de PROJECT-TEAM-FULL-COVERAGE §2 incluidos |
| **Orden** | Pasos ejecutados en orden; handoffs claros entre roles |
| **PROJECT-STATE** | Actualizado al finalizar run |
| **Diálogo** | Escalación cuando hay conflicto; AI Interactive Team protocol respetado |

**Áreas de ranqueo:** Inclusión (1–5), Orden y handoffs (1–5), Actualización de estado (1–5).

---

## MATPROMT (matprompt)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Bundle** | Prompts orientadores por rol §2 para el run (objetivo, lecturas, entregables, criterios, anti-patrones, handoff) en `docs/team/MATPROMT-FULL-RUN-PROMPTS.md` o `docs/team/matprompt/MATPROMT-RUN-*.md` |
| **Delta** | Si hubo tarea nueva o cambio de prioridad: subsección DELTA con roles afectados e instrucciones optimizadas |
| **Alineación** | Coherente con PROJECT-STATE, PROMPT-FOR-EQUIPO-COMPLETO y orden acordado con Parallel/Serial; roles N/A explícitos |
| **Calidad** | Prompts accionables; rutas de repo concretas; sin secretos en texto |

**Áreas de ranqueo:** Utilidad de los prompts (1–5), Alineación al run (1–5), Reacción a cambios mid-run (1–5).

---

## Contract (bmc-api-contract-validator)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Validación** | Respuestas API validadas contra contrato canónico |
| **Drift** | Drift detectado y notificado a Mapping |
| **Propagación** | Log for Mapping cuando hay drift |

**Áreas de ranqueo:** Validación (1–5), Detección de drift (1–5), Propagación (1–5).

---

## Calc (bmc-calculadora-specialist)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **BOM / precios** | Cálculos correctos; Drive, PDF, 5173 operativos |
| **Handoff** | Log for Mapping si hay cambios en datos o estructura |
| **Documentación** | Constantes, helpers, flujos documentados cuando aplica |

**Áreas de ranqueo:** Funcionalidad (1–5), Documentación (1–5), Handoffs (1–5).

---

## Security (bmc-security-reviewer)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Revisión** | OAuth, tokens, env, CORS, HMAC auditados |
| **Hallazgos** | Riesgos identificados con mitigación |
| **Propagación** | Log for Orchestrator en pre-deploy |

**Áreas de ranqueo:** Cobertura (1–5), Calidad de hallazgos (1–5), Propagación (1–5).

---

## Juez (bmc-team-judge)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Reporte por run** | JUDGE-REPORT-RUN-YYYY-MM-DD.md generado |
| **Reporte histórico** | JUDGE-REPORT-HISTORICO.md actualizado con promedios |
| **Criterios** | Uso de JUDGE-CRITERIA-POR-AGENTE.md para evaluar |
| **Objetivo** | Identificar oportunidades de evolución; no castigar |

**Áreas de ranqueo:** Completitud del reporte (1–5), Consistencia de criterios (1–5), Utilidad para evolución (1–5). *El Juez puede auto-evaluarse o ser evaluado por el usuario.*

---

## Parallel/Serial (bmc-parallel-serial-agent)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Evaluación paralelo/serie** | Plan que identifica correctamente qué tareas en paralelo vs serie según dependencias |
| **Combinación de agentes** | Recomendación basada en scores (JUDGE-REPORT-HISTORICO) y contexto; orientada al objetivo |
| **Uso de scores** | Cruza área de tarea con desempeño histórico de agentes; prioriza los que rinden mejor |
| **Handoff al Orquestador** | PARALLEL-SERIAL-PLAN o handoff directo con plan de ejecución claro |

**Áreas de ranqueo:** Precisión paralelo/serie (1–5), Calidad de combinación (1–5), Orientación a objetivo (1–5).

---

## SIM (Agente Simulador — Cursor)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Checklist** | Uso de `docs/team/panelsim/AGENT-SIMULATOR-SIM.md` + `SESSION-WORKSPACE-CRM.md` auto-start; no inventa IDs de sheet ni secretos |
| **Conexiones** | Citas correctas a `/capabilities`, `calc`, hub Sheets; si API no está, lo declara |
| **Handoff** | Consume artefactos de Mapping/Calc/Contract; no contradice `AGENTS.md` |

**Áreas de ranqueo:** Fidelidad al repo (1–5), Claridad al usuario (1–5). *Evaluación indirecta vía calidad del “Handoff a SIM” en bundle MATPROMT cuando el run tiene objetivo SIM.*

---

## SIM-REV (revisor post-SIM)

| Criterio | Entregable / Cómo juzgar |
|----------|---------------------------|
| **Informe** | `docs/team/panelsim/reports/SIM-REV-REVIEW-YYYY-MM-DD.md` con secciones definidas en `docs/team/panelsim/AGENT-SIMULATOR-SIM.md` §4 |
| **Contraste** | Mejoras en backlog vs estado real; riesgos contrato/Sheets/GPT mencionados |
| **Límites** | No duplica Judge; puede referenciar hallazgos para el reporte del Judge |

**Áreas de ranqueo:** Completitud del informe (1–5), Utilidad para siguiente run (1–5), No solapamiento dañino con Judge (1–5).

---

## Regla para nuevos agentes

Cuando se añade un nuevo rol a PROJECT-TEAM-FULL-COVERAGE §2, **debe** añadirse una sección aquí con:
- Entregables / Cómo juzgar
- Áreas de ranqueo (2–3 áreas relevantes para su función)

**Evolución:** Las habilidades y roles no son estáticos. Nuevos compañeros surgirán al correr e interactuar; este documento se actualiza con ellos. Ver PROJECT-TEAM-FULL-COVERAGE §0.

**Clones:** Un clon (ej. Mapping+1) se evalúa con los mismos criterios que su rol base (Mapping). El Juez puede agrupar clones del mismo rol para el reporte o listarlos por separado si aporta valor.
