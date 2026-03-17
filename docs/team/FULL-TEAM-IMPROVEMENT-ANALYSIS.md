# Full Team — Análisis de configuración y mejoras

**Propósito:** Analizar la configuración actual de los 19 miembros del equipo BMC/Panelin, evaluar propuestas de mejora (incl. knowledge base y skills especializados), y dar un marco para que el equipo evalúe más sugerencias.

---

## 1. Auditoría actual: qué tiene cada miembro

Cada rol tiene al menos un **skill** (SKILL.md). No todos tienen **reference.md**, **examples.md**, **scripts** o una **knowledge base** dedicada.

| Rol | Skill(s) | reference.md | examples.md | scripts/ | knowledge base |
|-----|----------|--------------|------------|----------|----------------|
| Mapping | bmc-planilla-dashboard-mapper, google-sheets-mapping-agent | google-sheets: ✓ | google-sheets: ✓ | — | references/ (mapper) |
| Design | bmc-dashboard-design-best-practices | ✓ | — | — | — |
| Sheets Structure | bmc-sheets-structure-editor | ✓ | ✓ | ✓ | — |
| Networks | networks-development-agent | ✓ | ✓ | ✓ | — |
| Dependencies | bmc-dependencies-service-mapper | ✓ | — | — | — |
| Integrations | shopify-integration-v4, browser-agent-orchestration | ✓ | — | — | — |
| GPT/Cloud | panelin-gpt-cloud-system, openai-gpt-builder-integration | openai: ✓ | openai: ✓ | — | — |
| Fiscal | bmc-dgi-impositivo | ✓ | ✓ | ✓ | — |
| Billing | billing-error-review | ✓ | ✓ | ✓ | — |
| Audit/Debug | bmc-dashboard-audit-runner, cloudrun-diagnostics-reporter | audit: —, cloudrun: ✓ | — | audit: ✓ | — |
| Reporter | bmc-implementation-plan-reporter | ✓ | — | — | — |
| Orchestrator | bmc-dashboard-team-orchestrator, ai-interactive-team | — | — | — | agent .md |
| Contract | bmc-api-contract-validator | ✓ | — | — | — |
| Calc | bmc-calculadora-specialist | ✓ | — | — | — |
| Security | bmc-security-reviewer | ✓ | — | — | — |
| Judge | bmc-team-judge | ✓ | — | — | JUDGE-CRITERIA-POR-AGENTE |
| Parallel/Serial | bmc-parallel-serial-agent | ✓ | — | — | — |
| Repo Sync | bmc-repo-sync-agent | — | — | — | — |

**Gaps detectados:**
- Varios skills sin `reference.md` (bmc-dashboard-debug-reviewer, bmc-repo-sync-agent, panelin-gpt-cloud-system, panelin-drift-risk-closure, etc.).
- La mayoría no tiene una **knowledge base** explícita por miembro (glosario, decisiones, patrones, handoffs típicos).
- No hay un **knowledge base del equipo completo** (cross-role patterns, flujos end-to-end, lecciones aprendidas).
- Skills especializados por **tarea** (ej. "go-live", "migración", "nueva tab") existen de forma parcial (one-click-setup, netuy-hosting) pero no están unificados con el full team.

---

## 2. Evaluación de tu propuesta: knowledge base por miembro + skills especializados

### 2.1 Knowledge base por miembro

**Tu idea:** Crear una base de conocimiento para cada uno.

**Evaluación: útil y recomendable.**

- **Por qué ayuda:** Cada agente hoy se apoya en SKILL.md + a veces reference/examples. Una knowledge base por rol centraliza:
  - **Glosario de dominio** (términos que ese rol usa: tabs, rutas API, estados de pago, etc.).
  - **Decisiones y convenciones** (ej. "Mapping siempre produce plan antes de implementar"; "Design solo consume payloads canónicos").
  - **Handoffs típicos** (qué escribe a quién, en qué formato).
  - **Artefactos que produce/consume** (entradas y salidas estables).
  - **Errores frecuentes y cómo evitarlos** (lecciones por run o por sync).

- **Implementación sugerida:**
  - Carpeta `docs/team/knowledge/` con un archivo por rol (ver `docs/team/knowledge/README.md`).
  - Ejemplo creado: `knowledge/Mapping.md` (Mapa). El resto de roles puede seguir el mismo esquema (Entradas, Salidas, Convenciones, Handoffs, Referencias).
  - O dentro de cada skill: `skills/<skill>/knowledge.md` (o carpeta `knowledge/`) que el agente lea al invocarse.
  - Contenido mínimo por archivo: **Entradas/Salidas**, **Convenciones**, **Handoffs**, **Referencias** (links a PROJECT-STATE, planilla-inventory, etc.).

- **Prioridad:** Alta para roles con muchos handoffs (Mapping, Design, Dependencies, Reporter, Orchestrator) y para Judge (criterios ya existen en JUDGE-CRITERIA-POR-AGENTE; se puede extender como knowledge del Juez).

### 2.2 Skills especializados por miembro

**Tu idea:** Skills más especializados para cada uno.

**Evaluación: parcialmente ya existe; se puede profundizar.**

- Hoy cada miembro tiene al menos un skill; algunos tienen dos (Mapping, Integrations, GPT/Cloud). "Especialización" puede significar:
  - **Sub-skills o variantes por tarea:** Ej. "Mapping para nueva tab", "Mapping para cambio de schema". Puede ser un mismo skill con secciones "Por tipo de tarea" en SKILL.md o reference.md, en lugar de multiplicar skills.
  - **Skills nuevos para tareas transversales:** Ya existen (one-click-setup, netuy-hosting, audit-runner, debug-reviewer). Tiene sentido seguir creando skills por **tarea o flujo** (ej. "go-live", "nueva integración", "cierre mensual") que invoquen a varios miembros; eso es más "skill para el equipo o para tarea" que "skill por miembro".

- **Recomendación:** No duplicar skills por miembro sin necesidad. Mejor:
  - Enriquecer el skill existente con **knowledge base** (ver arriba) y **examples.md** con casos concretos.
  - Crear **skills por flujo/tarea** (full team o subconjunto) que referencien a los miembros y su knowledge.

### 2.3 Skills para el equipo completo o para tareas especiales

**Idea:** Skills que aplican al full team o a tareas concretas.

**Evaluación: muy útil.**

- Ejemplos:
  - **Invoque full team:** Ya existe (rule + skill bmc-project-team-sync + INVOQUE-FULL-TEAM.md).
  - **Go-live dashboard:** GO-LIVE-DASHBOARD-CHECKLIST + one-click-setup.
  - **Audit a fondo:** bmc-dashboard-audit-runner → debug-reviewer.
  - **Nueva tab end-to-end:** Un skill o doc que encadene Mapping → (Sheets Structure si aplica) → Design → PROJECT-STATE.

- **Recomendación:** Mantener y ampliar este enfoque: documentos y/o skills por **flujo** (go-live, nueva tab, migración, cierre mensual, full audit) que listen pasos y agentes involucrados y enlacen a knowledge de cada rol.

---

## 3. Otras mejoras que el equipo puede evaluar

El equipo (Orquestador + cualquier miembro que opine) puede usar esta lista para decidir qué adoptar. Cada ítem puede votarse o priorizarse en un run (ej. Judge o Fiscal recogen sugerencias y las llevan a PROJECT-STATE o a este doc).

| # | Mejora | Descripción | Prioridad sugerida |
|---|--------|-------------|--------------------|
| 1 | Knowledge base por miembro | Doc por rol (entradas/salidas, convenciones, handoffs). Ver §2.1. | Alta |
| 2 | Knowledge base del equipo | Doc compartido: flujos end-to-end, patrones cross-role, lecciones aprendidas. | Media |
| 3 | reference.md en todos los skills | Los skills sin reference.md reciben un reference mínimo (alcance, artefactos, criterios). | Alta |
| 4 | examples.md donde falte | Casos concretos por rol (ej. "nueva tab", "cambio de hosting") para invocaciones más precisas. | Media |
| 5 | Skills por flujo/tarea | Skills o docs por "nueva tab", "migración", "cierre mensual", "full audit", etc. | Media |
| 6 | Checklist pre-run por rol | Lista corta "antes de ejecutar, leer X, comprobar Y" en cada SKILL o knowledge. | Media |
| 7 | Glosario único | Un GLOSSARY.md (docs/team o repo) con términos de dominio; todos los roles lo referencian. | Baja |
| 8 | Run retrospectiva (Judge + Orquestador) | Tras cada full run, aparte del JUDGE-REPORT: 1 página "qué mejorar en conocimiento/proceso" y actualizar knowledge o PROJECT-STATE. | Media |
| 9 | Handoff templates | Plantillas estándar "Log for X" y "Pendientes" para que todos escriban en el mismo formato. | Baja |
| 10 | Paralelo/Serial + Judge | Que Parallel/Serial use de forma explícita JUDGE-REPORT-HISTORICO y knowledge de handoffs para proponer mejores combinaciones. | Media |

---

## 4. Cómo usar este documento (evaluación del equipo)

- **Invoque full team** puede incluir, en un paso opcional (ej. después del Judge o en paso 8), la lectura de este documento y la actualización de la tabla de mejoras (prioridad, responsable, estado).
- Cualquier miembro puede proponer una nueva fila en la tabla (§3) o modificar la evaluación de la propuesta del usuario (§2); el Orquestador o el Juez pueden consolidar.
- Si se adopta "knowledge base por miembro", el orden sugerido de creación es: Mapping, Design, Dependencies, Reporter, Orchestrator, Judge; luego el resto.
- **Estado:** Este doc es la primera versión del análisis y de la lista de mejoras; el equipo puede refinarlo en el próximo full run o en un sync dedicado.

---

## 5. Resumen ejecutivo

| Tema | Conclusión |
|------|------------|
| Knowledge base por miembro | **Útil.** Implementar en `docs/team/knowledge/<Rol>.md` o dentro de cada skill. Priorizar roles con muchos handoffs. |
| Skills más especializados por miembro | **Mejor no multiplicar skills;** enriquecer los existentes con knowledge + examples. |
| Skills para full team o tareas especiales | **Muy útil.** Mantener y ampliar (flujos: go-live, nueva tab, migración, cierre, audit). |
| Otras mejoras | Tabla §3: 10 ítems para que el equipo evalúe y priorice (reference en todos, examples, checklist pre-run, retrospectiva, etc.). |
| Próximo paso concreto | Crear `docs/team/knowledge/` y los primeros knowledge docs (Mapping, Design, Dependencies, Reporter, Orchestrator); opcionalmente añadir al full run un paso de "revisar FULL-TEAM-IMPROVEMENT-ANALYSIS y actualizar prioridades". |
