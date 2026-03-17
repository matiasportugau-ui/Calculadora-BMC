# Full Project Status — Revisión y Plan Task-by-Task

**Fecha:** 2025-03-15  
**Origen:** Full team review — estado del proyecto, plan operacional, evaluación del equipo

---

## 1. Resumen ejecutivo del estado actual

### 1.1 Lo que está operativo

| Componente | Estado | Notas |
|------------|--------|-------|
| **Calculadora** | OK | Puerto 5173, link desde shell |
| **Dashboard Finanzas/Operaciones** | OK | 3001/finanzas, KPIs, Breakdown, Entregas, Metas, Audit |
| **Planillas mapeadas** | OK | CRM_Operativo, Pagos_Pendientes (conditional), Metas_Ventas (conditional), AUDIT_LOG |
| **API server** | OK | server/index.js, bmcDashboard routes |
| **Integraciones** | Parcial | Sheets, Drive, ML OAuth, Shopify |
| **Equipo de agentes** | OK | 17 roles, docs/team/ organizado, Judge, Fiscal, Parallel/Serial |
| **Documentación** | OK | docs/team/, bmc-dashboard-modernization, planilla-inventory |

### 1.2 Lo que está pendiente

| Componente | Estado | Bloqueador |
|------------|--------|------------|
| **Ventas 2.0** | Placeholder | Sin planilla ni API |
| **Invoque Panelin** | Placeholder | Sin entry points transversales |
| **UX time-saving** | Pendiente | C1–C5 dependen de S1; C2, C6, C7 ya hechos |
| **/health hasSheets** | OK | C6 — ya implementado |
| **Doc 3849 vs 3001** | OK | C7 — PUERTOS-3849-VS-3001.md creado |
| **Skills PROJECT-STATE** | Parcial | ~12 skills sin instrucción |
| **Orquestador extendido** | Parcial | Contract y Security no en run |
| **Judge report** | Sin runs | JUDGE-REPORT-HISTORICO vacío |

### 1.3 Premisas actuales

- **Producción:** Cloud Run (panelin-calc); posible VPS Netuy
- **Local:** 3001 (API), 3849 (standalone), 5173 (Calculadora)
- **ngrok:** puerto 4040 para OAuth
- **Workbook:** 1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg

---

## 2. Plan task-by-task para full operacional

### Fase 0 — Verificación base (inmediato)

| ID | Task | Responsable | Acceptance | Deps |
|----|------|-------------|------------|------|
| T0.1 | Verificar que `npm run dev:full` o `dev:full-stack` levanta API + Vite | Coding | API en 3001, Vite en 5173 | — |
| T0.2 | Verificar GET /health existe y responde | Coding | 200 + JSON | — |
| T0.3 | Verificar que /health incluye `hasSheets` (C6) | Coding | Campo presente | — |
| T0.4 | Documentar 3849 vs 3001 en setup (C7) | Coding | Doc en IA o setup | — |

### Fase 1 — Quick wins (sin S1)

| ID | Task | Responsable | Acceptance | Deps |
|----|------|-------------|------------|------|
| T1.1 | C2: Mensaje "Reintentar" + botón cuando API retorna 503 | Coding | Banner visible; click reintenta fetch | — |
| T1.2 | C6: /health incluye hasSheets | Coding | GET /health devuelve hasSheets | — |
| T1.3 | C7: Doc 3849 vs 3001 | Coding | Doc actualizado | — |

### Fase 2 — UX Opción A (tras S1)

| ID | Task | Responsable | Acceptance | Deps |
|----|------|-------------|------------|------|
| T2.0 | S1: Solution aprueba propuesta UX Opción A | Solution | Spec de loading, filtros, feedback | — |
| T2.1 | C1: Loading skeleton/spinner en bloques /api/* | Coding | Spinner visible mientras fetch | S1 |
| T2.2 | C3: Filtros "Esta semana" \| "Vencidos" en Breakdown | Coding | Filtros funcionan; default "Esta semana" | S1 |
| T2.3 | C4: Sticky header en tablas Entregas y Breakdown | Coding | Headers fijos al scroll | S1 |
| T2.4 | C5: Toast tras Marcar entregado y Copiar WhatsApp | Coding | Feedback visible tras acción | S1 |
| T2.5 | Solution valida en browser | Solution | C1–C5 verificados | T2.1–T2.4 |

### Fase 3 — Hardening del equipo

| ID | Task | Responsable | Acceptance | Deps |
|----|------|-------------|------------|------|
| T3.1 | Añadir "Antes de trabajar, leer docs/team/PROJECT-STATE.md" a google-sheets-mapping-agent, bmc-dashboard-design-best-practices, bmc-dependencies-service-mapper, bmc-implementation-plan-reporter | Orquestador | 4 skills actualizados | — |
| T3.2 | Añadir referencia propagación a bmc-dgi-impositivo, billing-error-review, bmc-dashboard-debug-reviewer | Orquestador | 3 skills actualizados | — |
| T3.3 | Añadir "Al terminar, actualizar PROJECT-STATE" a bmc-dashboard-audit-runner | Orquestador | 1 skill actualizado | — |
| T3.4 | Añadir referencia propagación a networks-development-agent, shopify-integration-v4, panelin-gpt-cloud-system | Orquestador | 3 skills actualizados | — |
| T3.5 | En networks-development-agent: "Para deploy Netuy, usar bmc-dashboard-netuy-hosting" | Orquestador | Referencia añadida | — |
| T3.6 | Orquestador: añadir Contract Validator (pre-check) antes de Design | Orquestador | Paso en bmc-dashboard-team-orchestrator | — |
| T3.7 | Orquestador: añadir Security Review (pre-deploy) antes de Reporter | Orquestador | Paso en bmc-dashboard-team-orchestrator | — |
| T3.8 | Documentar runs especiales (Audit, Sync, GPT) en orquestador | Orquestador | Sección añadida | — |

### Fase 4 — Full operacional (opcional / futuro)

| ID | Task | Responsable | Acceptance | Deps |
|----|------|-------------|------------|------|
| T4.1 | S2: Definir estructura planilla Ventas 2.0 | Solution | Spec columnas y API | — |
| T4.2 | Implementar Ventas 2.0 | Coding | Pipeline, Costeo, Administrar Venta | S2 |
| T4.3 | S3: Aprobar entry points Invoque Panelin | Solution | Doc ubicaciones | — |
| T4.4 | Implementar Invoque transversal | Coding | Entry points operativos | S3 |

---

## 3. Orden de ejecución recomendado

```
Fase 0 (verificación) → T0.1, T0.2, T0.3, T0.4
Fase 1 (quick wins)   → T1.1, T1.2, T1.3  (en paralelo si aplica)
Fase 2 (UX)           → T2.0 (S1) → T2.1–T2.4 → T2.5
Fase 3 (hardening)     → T3.1–T3.8  (puede hacerse en paralelo con Fase 1/2)
Fase 4 (futuro)        → cuando se priorice Ventas 2.0 / Invoque
```

---

## 4. Evaluación del equipo — funcionamiento y mejoras

### 4.1 Cómo está funcionando el equipo

| Aspecto | Estado | Observación |
|---------|--------|-------------|
| **Estructura** | Bien | docs/team/ organizado; roles claros; PROJECT-STATE como fuente de verdad |
| **Propagación** | Parcial | Tabla definida; no todos los skills la referencian |
| **Full team run** | Parcial | Orquestador ejecuta Mapping→Dependencies→Design→Reporter→Judge; faltan Contract, Security, Fiscal explícitos |
| **Judge** | Sin datos | No hay runs evaluados; JUDGE-REPORT-HISTORICO vacío |
| **Parallel/Serial** | Sin uso | No se ha invocado para optimizar runs |
| **Fiscal** | Documentado | Ranking y protocolo definidos; supervisión pendiente de ejecución |
| **Clonación** | Documentada | Capacidad definida; no usada aún |

### 4.2 Mejoras necesarias

| Mejora | Prioridad | Acción |
|--------|-----------|--------|
| **Ejecutar Judge tras cada run** | Alta | Asegurar que paso 6 (Judge) se ejecute y genere JUDGE-REPORT-RUN |
| **Consultar Parallel/Serial antes de runs complejos** | Media | Incluir paso 0b en orquestador cuando hay múltiples tareas |
| **Integrar Contract y Security en full run** | Alta | T3.6, T3.7 |
| **Skills con PROJECT-STATE** | Alta | T3.1–T3.4 |
| **Fiscal ejecute supervisión** | Media | Incluir paso Fiscal en run o run periódico |
| **Runs especiales documentados** | Media | T3.8 |
| **Primer Judge report** | Alta | Ejecutar un run y que Judge genere primer reporte |

### 4.3 Evaluación de funcionalidad del equipo

| Dimensión | Score (1–5) | Comentario |
|-----------|-------------|------------|
| **Cobertura de roles** | 4 | 17 roles; gaps en Ventas/Invoque, Apps Script, QA |
| **Documentación** | 5 | docs/team/ bien estructurado; artefactos claros |
| **Orquestación** | 3 | Orden definido; Contract/Security/Fiscal no integrados |
| **Propagación** | 3 | Tabla existe; skills no la usan todos |
| **Evolución** | 5 | Principio §0; clonación; nuevas habilidades |
| **Evaluación (Judge)** | 1 | Sin runs evaluados |
| **Operacionalidad producto** | 3 | Dashboard OK; UX pendiente; Ventas/Invoque placeholder |

---

## 5. Checklist de full operacional

Para considerar el proyecto **fully operational** según premisas actuales:

- [ ] Fase 0 completada (verificación base)
- [ ] Fase 1 completada (C2, C6, C7)
- [ ] S1 aprobado
- [ ] Fase 2 completada (C1, C3, C4, C5)
- [ ] Fase 3 completada (skills, orquestador extendido)
- [ ] Al menos un Judge report generado
- [ ] PROJECT-STATE actualizado con cada cambio
- [ ] Dashboard accesible en localhost; API respondiendo

---

## 6. Próximos pasos inmediatos

1. **Ejecutar T0.1–T0.4** — Verificar stack y /health.
2. **Ejecutar T1.1–T1.3** — Quick wins (C2, C6, C7).
3. **Solicitar S1** — Solution aprueba UX Opción A.
4. **Ejecutar T2.1–T2.4** — Tras S1.
5. **Ejecutar T3.1–T3.8** — Hardening (puede hacerse en paralelo).
6. **Full team run con Judge** — Generar primer JUDGE-REPORT-RUN.
7. **Actualizar PROJECT-STATE** — Tras cada fase.

---

**Referencias:** [PROJECT-STATE.md](./PROJECT-STATE.md), [plans/PLAN-EQUIPO-3-PASOS-SIGUIENTES.md](./plans/PLAN-EQUIPO-3-PASOS-SIGUIENTES.md), [meta/EQUIPO-META-EVALUACION.md](./meta/EQUIPO-META-EVALUACION.md), [IMPLEMENTATION-PLAN-SOLUTION-CODING](../../bmc-dashboard-modernization/IMPLEMENTATION-PLAN-SOLUTION-CODING.md).
