# Plan — 3 pasos siguientes del equipo BMC/Panelin

**Plan vigente para el equipo completo.** Derivado del full team run, la meta-evaluación y el implementation plan vigente.

---

## Contexto

Tras el full team run y la meta-evaluación ([EQUIPO-META-EVALUACION.md](../meta/EQUIPO-META-EVALUACION.md)), el equipo tiene:

- **Implementation plan vigente:** [IMPLEMENTATION-PLAN-SOLUTION-CODING.md](../../bmc-dashboard-modernization/IMPLEMENTATION-PLAN-SOLUTION-CODING.md) con tareas S1–S3 (Solution) y C1–C7 (Coding)
- **Propuesta UX aprobada para ejecutar:** Opción A en [DESIGN-PROPOSAL-TIME-SAVING.md](../../bmc-dashboard-modernization/DESIGN-PROPOSAL-TIME-SAVING.md)
- **Mejoras de equipo pendientes:** skills sin PROJECT-STATE, orquestador sin Contract/Security, runs especiales no documentados

---

## Paso 1 — Quick wins (Coding, sin dependencia Solution)

**Objetivo:** Implementar C2, C6 y C7 del implementation plan. No requieren aprobación de Solution.

| Tarea | Descripción | Artefacto |
|-------|-------------|-----------|
| **C2** | Mensaje "Reintentar" + botón cuando API retorna 503 | Banner con botón; click reintenta fetch |
| **C6** | Verificar `/health` incluye `hasSheets` | GET /health devuelve hasSheets |
| **C7** | Documentar 3849 vs 3001 en setup (si falta) | Doc actualizado en setup/IA |

**Responsable:** Coding (Design skill puede guiar UX de C2).  
**Handoff:** Al terminar, actualizar [PROJECT-STATE.md](../PROJECT-STATE.md) y marcar C2, C6, C7 como implementados.

---

## Paso 2 — UX Opción A (Solution aprueba → Coding implementa)

**Objetivo:** Ejecutar S1 + C1, C3, C4, C5. Solution aprueba la propuesta UX; Coding implementa loading, filtros, sticky headers y feedback.

**2a. Solution (S1):** Aprobar propuesta UX Opción A (DESIGN-PROPOSAL-TIME-SAVING). Entregar spec de loading, filtros y feedback a Coding.

**2b. Coding (C1, C3, C4, C5):**

| ID | Task | Acceptance |
|----|------|------------|
| C1 | Loading skeleton/spinner en bloques que consumen /api/* | Spinner visible mientras fetch |
| C3 | Filtros rápidos "Esta semana" \| "Vencidos" en Breakdown | Filtros funcionan; default "Esta semana" |
| C4 | Sticky header en tablas Entregas y Breakdown | Headers fijos al scroll |
| C5 | Toast o mensaje de éxito tras Marcar entregado y Copiar WhatsApp | Feedback visible tras acción |

**Handoff:** Solution valida en browser tras entrega de Coding.

---

## Paso 3 — Hardening del equipo (orquestación y skills)

**Objetivo:** Aplicar las mejoras de [EQUIPO-META-EVALUACION.md](../meta/EQUIPO-META-EVALUACION.md) para que el equipo esté mejor configurado y sincronizado.

**3a. Skills con PROJECT-STATE y propagación**

Añadir en los SKILL.md de estos skills la instrucción correspondiente:

| Skill | Añadir |
|-------|--------|
| google-sheets-mapping-agent, bmc-dashboard-design-best-practices, bmc-dependencies-service-mapper, bmc-implementation-plan-reporter | "Antes de trabajar, leer docs/PROJECT-STATE.md si existe." |
| bmc-dgi-impositivo, billing-error-review, bmc-dashboard-debug-reviewer | "Si hallazgos afectan otros agentes, consultar tabla de propagación PROJECT-TEAM-FULL-COVERAGE §4 y notificar." |
| bmc-dashboard-audit-runner | "Al terminar, actualizar PROJECT-STATE si hay hallazgos críticos." |
| networks-development-agent, shopify-integration-v4, panelin-gpt-cloud-system | "Consultar tabla de propagación PROJECT-TEAM-FULL-COVERAGE §4 para notificar a agentes afectados." |

**3b. Orquestador extendido**

Actualizar `.cursor/agents/bmc-dashboard-team-orchestrator.md` para incluir:

- Paso 4 (nuevo): **Contract Validator** (pre-check) — `bmc-api-contract-validator` antes de Design
- Paso 6 (nuevo): **Security Review** (pre-deploy) — `bmc-security-reviewer` antes de Reporter
- Sección "Runs especiales": Audit run, Sync run, GPT run (referencia a bmc-project-team-sync)

**3c. Referencias cruzadas en overlaps**

- En `networks-development-agent/SKILL.md`: "Para deploy Netuy, usar bmc-dashboard-netuy-hosting"
- En skills GPT/Cloud: orden gpt-builder-integration → panelin-gpt-cloud-system → drift-risk-closure

---

## Orden de ejecución

Paso 1 puede ejecutarse de inmediato. Paso 2 depende de S1 (aprobación Solution). Paso 3 puede hacerse en paralelo o después de Paso 1.

---

## Resumen

| Paso | Contenido | Dependencias |
|------|-----------|--------------|
| **1** | C2, C6, C7 (quick wins) | Ninguna |
| **2** | S1 + C1, C3, C4, C5 (UX Opción A) | S1 aprobado |
| **3** | Skills PROJECT-STATE, orquestador extendido, referencias overlaps | Ninguna |

Al finalizar cada paso, actualizar [PROJECT-STATE.md](../PROJECT-STATE.md) en "Cambios recientes" y "Pendientes" si aplica.
