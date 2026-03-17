# BMC/Panelin — Equipo de cobertura total y sincronización de cambios

**Propósito:** Definir un equipo que cubra todas las aristas del proyecto y un mecanismo para que todos los agentes estén actualizados cuando hay cambios en cualquier área.

---

## 0. Principio: equipo y dominio evolucionan

**Las habilidades y los roles no son estáticos.** A medida que el equipo corre, interactúa e intercambia, surgirán nuevas habilidades y compañeros necesarios. El equipo evoluciona; todas las variables (roles, skills, áreas, propagación, criterios del Juez, ranking del Fiscal, etc.) se ajustan tras cualquier modificación o crecimiento del dominio.

- **Nuevos skills/roles:** Añadirlos a §2 y a JUDGE-CRITERIA-POR-AGENTE en cuanto existan.
- **Cambios de dominio:** Actualizar §1 (áreas), §4 (propagación), PROJECT-STATE (estado por área).
- **Crecimiento:** Revisar orquestador, runs especiales, handoffs; propagar a los afectados.

---

## 0.1 Capacidades de todos los miembros

**Nueva habilidad:** Todo miembro puede adquirir una habilidad nueva si es necesaria y aprobada por la parte correspondiente (Orquestador, usuario o agente afectado según el caso), o si es pedida explícitamente.

**Clonación:** Todo miembro puede multiplicarse llamando a su clon. El clon se nombra con el rol base + número incremental: `Mapping`, `Mapping+1`, `Mapping+2`, … Cada vez que se invoca un clon, se suma +1 al contador. Los clones comparten el mismo skill y responsabilidad; se usan para paralelizar trabajo o cubrir carga.

---

## 1. Áreas del proyecto (dominios)

| Área | Contenido | Artefactos clave |
|------|-----------|------------------|
| **Sheets / Planillas** | Tabs, columnas, schemas, CRM_Operativo, Master_Cotizaciones, Pagos_Pendientes, Metas_Ventas, AUDIT_LOG | planilla-inventory.md, planilla-map.md, bmcDashboard.js |
| **Dashboard UI** | Finanzas, Operaciones, KPIs, entregas, metas, audit, Ventas 2.0, Invoque Panelin | dashboard/index.html, app.js, styles.css, DASHBOARD-INTERFACE-MAP |
| **Calculadora / Cotizaciones** | Cotizador React, Drive, Budget Log, PDF | PanelinCalculadoraV3_backup.jsx, 5173 |
| **Infraestructura** | Hosting, VPS, Netuy, Cloud Run, ngrok, puertos 3001/3849/5173 | HOSTING-EN-MI-SERVIDOR.md, .env, server/index.js |
| **Integraciones** | MercadoLibre, Shopify, Google Drive, Sheets API | server/routes/, tokenStore, shopifyStore |
| **GPT / Invoque Panelin** | OpenAPI, GPT Actions, Cloud Run calc | docs/openapi-calc.yaml, GPT Builder |
| **Fiscal / Oversight** | Fiscaliza operaciones, analiza alternativas (energía/tiempo/dinero), reporta al Orquestador; IVA/CFE cuando aplica | bmc-dgi-impositivo |
| **Facturación / Billing** | Revisión de errores, duplicados, cierre mensual | billing-error-review |
| **Audit / Debug** | Auditoría dashboard, logs, diagnóstico | bmc-dashboard-audit-runner, cloudrun-diagnostics |
| **Reporting** | Planes para Solution/Coding, handoffs | bmc-implementation-plan-reporter |

---

## 2. Equipo por área (roles y skills)

**Regla:** Esta tabla es la lista canónica del Equipo Completo. Todo rol o skill nuevo (creado por el equipo o por el usuario) debe añadirse aquí de inmediato. Al invocar "Equipo completo", todos los miembros de esta tabla se incluyen automáticamente.

**Evolución:** La tabla no es estática. Nuevos compañeros y habilidades surgirán al correr e interactuar; añadirlos aquí y en JUDGE-CRITERIA-POR-AGENTE.

| Rol | Skill(s) | Área(s) | Responsabilidad |
|-----|----------|---------|-----------------|
| **Mapping** | bmc-planilla-dashboard-mapper, google-sheets-mapping-agent | Sheets, Dashboard (mapeo) | Planilla map, interface map, cross-reference |
| **Design** | bmc-dashboard-design-best-practices | Dashboard UI | UX/UI, jerarquía, estados loading/error |
| **Sheets Structure** | bmc-sheets-structure-editor | Sheets | Tabs, dropdowns, estructura (Matias only) |
| **Networks** | networks-development-agent | Infraestructura | Hosting, migración, endpoints, storage |
| **Dependencies** | bmc-dependencies-service-mapper | Todas | Grafo de dependencias, service map |
| **Integrations** | shopify-integration-v4, browser-agent-orchestration | Integraciones | Shopify, ML, OAuth, webhooks |
| **GPT/Cloud** | panelin-gpt-cloud-system, openai-gpt-builder-integration | GPT, Cloud Run | OpenAPI, GPT Builder, drift closure |
| **Fiscal** | bmc-dgi-impositivo | Oversight & Efficiency | Fiscaliza operaciones; supervisa protocolo PROJECT-STATE según FISCAL-PROTOCOL-STATE-RANKING; controla incumplimientos; si ocurren, comunica a involucrados para que no pase de nuevo; analiza alternativas; reporta al Orquestador |
| **Billing** | billing-error-review | Facturación | Errores, duplicados, cierre |
| **Audit/Debug** | bmc-dashboard-audit-runner, cloudrun-diagnostics-reporter | Audit | Auditoría, logs, diagnóstico |
| **Reporter** | bmc-implementation-plan-reporter | Reporting | Planes Solution/Coding, handoffs |
| **Orchestrator** | bmc-dashboard-team-orchestrator, ai-interactive-team | Coordinación | Orden, handoffs, diálogo entre agentes |
| **Contract** | bmc-api-contract-validator | API | Validar respuestas contra contrato canónico |
| **Calc** | bmc-calculadora-specialist | Calculadora | BOM, precios, Drive, PDF, 5173 |
| **Security** | bmc-security-reviewer | Seguridad | OAuth, tokens, env, CORS, HMAC |
| **Judge** | bmc-team-judge | Evaluación y ranqueo | Evalúa forma de trabajo y desempeño; ranqueo por agente; reporte por run y promedio histórico; criterios individuales por agente; evolución continua |
| **Parallel/Serial** | bmc-parallel-serial-agent | Estrategia de ejecución | Evalúa según mejores desempeños en áreas y tareas; sabe qué procesos ejecutar en paralelo vs serie; prevé mejor combinación de agentes según scores y contexto; muy orientado a objetivos |
| **Repo Sync** | bmc-repo-sync-agent | Repos | Mantiene actualizados bmc-dashboard-2.0 (desarrollo y funcionamiento del dashboard) y bmc-development-team; tras cada corrida evalúa qué actualizar y sincroniza |

---

## 3. Fuente única de estado (PROJECT-STATE.md)

Para que todos estén actualizados, se usa un **archivo de estado del proyecto** que todos leen y algunos escriben.

**Ubicación:** `docs/team/PROJECT-STATE.md`

**Estructura:**

```markdown
# Project State — BMC/Panelin

Última actualización: YYYY-MM-DD HH:MM

## Cambios recientes (últimos 30 días)

| Fecha | Área | Cambio | Afecta a | Estado |
|-------|------|--------|----------|--------|
| 2025-03-15 | Sheets | Nueva tab Metas_Ventas | Mapping, Design | Implementado |
| 2025-03-14 | Infra | Migración VPS Netuy planificada | Networks, Mapping, Design | En revisión |

## Estado por área

### Sheets
- Workbook: 1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg
- Schema activo: CRM_Operativo
- Tabs: CRM_Operativo, Parametros, ... (ver planilla-inventory.md)

### Dashboard
- Puertos: 3001 (canónico), 3849 (standalone), 5173 (Calculadora)
- Secciones: Finanzas, Operaciones, Ventas (placeholder), Invoque (placeholder)

### Infraestructura
- Producción: [Cloud Run / VPS / ...]
- ngrok: puerto 4040

## Pendientes de sincronización

- [ ] Design: integrar nueva serie X (Mapping ya mapeó)
- [ ] Networks: validar CORS post-migración
```

**Regla:** Cualquier agente que haga un cambio que afecte a otros **debe** actualizar PROJECT-STATE.md (sección "Cambios recientes" y "Pendientes") y opcionalmente notificar a los afectados vía Log for X.

---

## 4. Propagación de cambios (quién debe saber qué)

Cuando cambia **X**, los agentes en **Y** deben ser notificados o leer el estado actualizado:

| Si cambia | Notificar / actualizar |
|-----------|------------------------|
| **Nueva tab o columna en Sheets** | Mapping → Design, Dependencies |
| **Cambio de schema (CRM vs Master)** | Mapping → Design, Networks (env) |
| **Nuevo endpoint API** | Mapping → Design, Networks, Dependencies |
| **Cambio de hosting / URL** | Networks → Mapping, Design, Integrations (OAuth redirect) |
| **Cambio en OpenAPI / GPT** | GPT/Cloud → Integrations, Design (si hay UI) |
| **Nueva sección en Dashboard** | Design → Mapping (data source), Dependencies |
| **Cambio en Shopify / ML** | Integrations → Networks (webhooks), Design (si hay UI) |
| **Error fiscal detectado** | Fiscal → Billing, Mapping (si afecta datos) |
| **Audit / debug findings** | Audit → Design, Networks, Mapping (según hallazgo) |
| **Hallazgos del Juez** | Judge → Orquestador, agente afectado (oportunidades de evolución) |
| **Incumplimiento protocolo PROJECT-STATE** | Fiscal → agente involucrado (Log for [Agent]), Orquestador si Crítico/Alto |
| **Nuevo rol o skill** | Quien lo crea → añadir a §2, JUDGE-CRITERIA-POR-AGENTE; Orquestador, Sync |
| **Crecimiento o modificación del dominio** | Quien detecta → actualizar §1, §4, PROJECT-STATE; propagar a afectados |
| **Plan de ejecución paralelo/serie** | Parallel/Serial → Orquestador (PARALLEL-SERIAL-PLAN); usa scores del Judge, dependencies |
| **Cambio en Dashboard o artefactos equipo** | Repo Sync → sync a bmc-dashboard-2.0 y bmc-development-team |
| **Repo Sync actualiza repos** | Repo Sync → reportar al Orquestador; actualizar PROJECT-STATE si aplica |

---

## 5. Puntos de sincronización

### 5.1 Al iniciar una tarea

Cada agente, antes de trabajar:

1. **Leer** `docs/team/PROJECT-STATE.md` (cambios recientes, pendientes).
2. **Leer** los artefactos de su área y de las áreas que lo afectan (según tabla de propagación).
3. Si hay "Pendientes de sincronización" que lo involucran, resolverlos primero o documentar dependencia.

### 5.2 Al terminar un cambio

Cada agente, después de implementar:

1. **Actualizar** `docs/team/PROJECT-STATE.md`:
   - Nueva fila en "Cambios recientes".
   - Si afecta a otros: añadir ítem en "Pendientes de sincronización" o escribir Log for X.
2. **Escribir** Log for [Agent] si el cambio afecta a otro rol (formato AI Interactive Team).

### 5.3 Sincronización periódica (manual o por comando)

- **Comando sugerido:** "Sync project state" o "Actualizar estado del proyecto".
- **Acción:** Un agente (Orchestrator o cualquiera) lee todos los artefactos clave, detecta drift, y actualiza PROJECT-STATE.md.
- **Frecuencia:** Antes de un deploy, después de un sprint, o cuando el usuario lo pida.

### 5.4 Full team run (Equipo Completo)

- **Comando:** "Run full BMC team" / "Equipo completo BMC" / "Equipo completo".
- **Regla obligatoria:** Todos los miembros del equipo definidos en §2 (tabla "Equipo por área") se adjuntan siempre al llamado de Equipo Completo. No se excluye a ningún rol para evitar pérdidas.
- **Fuente de verdad:** La tabla de §2 es la lista canónica. Cualquier skill o rol nuevo (creado por el equipo o por el usuario) debe añadirse a esa tabla en cuanto exista.
- **Acción:** Orchestrator lee §2, incluye a todos los roles en el run (en orden según dependencias) o en una ronda de sincronización. Los roles con paso explícito ejecutan; los demás reciben handoff y actualizan PROJECT-STATE si aplica.
- **Resultado:** Todos los artefactos actualizados; PROJECT-STATE.md refleja el estado final; ningún miembro queda fuera.

---

## 6. Flujo de trabajo recomendado

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  USUARIO                                                                     │
│  "Hay un cambio en [área]. Necesito que todos estén al día."                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. Agente del área afectada ejecuta su skill                                │
│  2. Escribe cambio en PROJECT-STATE.md                                      │
│  3. Identifica agentes afectados (tabla propagación)                         │
│  4. Escribe Log for [Agent] para cada afectado                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. Agentes afectados leen PROJECT-STATE + Log for ellos                     │
│  6. Ejecutan ajustes si aplica (AI Interactive Team protocol)                 │
│  7. Actualizan PROJECT-STATE si hay nuevos pendientes                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  8. Usuario revisa; si hay desacuerdo → escalación (AI Interactive Team)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Creación inicial de PROJECT-STATE.md

Si el archivo no existe, el Orchestrator o cualquier agente puede generarlo con:

1. Lectura de: planilla-inventory.md, DASHBOARD-VISUAL-MAP, IA.md, .env.example, package.json.
2. Resumen por área (Sheets, Dashboard, Infra, Integraciones).
3. Sección "Cambios recientes" vacía o con último commit relevante.
4. Sección "Pendientes" vacía.

---

## 8. Resumen ejecutivo

| Elemento | Descripción |
|----------|-------------|
| **Equipo** | Roles dinámicos; nuevos skills y compañeros surgen al interactuar; tabla §2 y criterios del Juez se actualizan |
| **Dominio** | Áreas, propagación y variables se ajustan tras modificaciones o crecimiento |
| **Fuente de verdad** | `docs/team/PROJECT-STATE.md` — todos leen, los que cambian escriben |
| **Propagación** | Tabla "Si cambia X → notificar Y" (evoluciona con el dominio) |
| **Sincronización** | Al iniciar tarea (leer estado), al terminar (actualizar estado), periódica (sync), full run |
| **Protocolo** | AI Interactive Team para diálogo y escalación cuando hay conflicto |

---

## 9. Próximos pasos

1. **Crear** `docs/team/PROJECT-STATE.md` con estado actual (primera generación).
2. **Añadir** a cada skill una instrucción: "Antes de trabajar, leer PROJECT-STATE.md si existe."
3. **Añadir** al Orchestrator: "Al finalizar un run, actualizar PROJECT-STATE.md."
4. **Probar** con un cambio real (ej. nueva tab) y verificar que Mapping → Design → PROJECT-STATE se cumple.
