# Cuadro comparativo preciso — BMC/Panelin vs arquitecturas populares de equipos de agentes

**Propósito:** Evaluar **todos** los enfoques documentados en esta KB **más** el sistema propio (`BMC/Panelin`), en dimensiones operativas y de gobernanza, para responder: **¿estamos corriendo bien?**

**Fuentes internas:** `FULL-TEAM-RUN-DEFINITION.md`, `RUN-SCOPE-GATE.md`, `RUN-MODES-AND-TRIGGERS.md`, `INVOQUE-FULL-TEAM.md`, `PROJECT-TEAM-FULL-COVERAGE.md` §2, Orquestador, `JUDGE-CRITERIA-POR-AGENTE.md`, `AGENTS.md`, `HUMAN-GATES-ONE-BY-ONE.md`.

**Fuentes KB externas (resúmenes):** subcarpetas `openai-swarm-and-agents-sdk`, `crewai`, `microsoft-autogen`, `langgraph-supervisor`, `google-adk`, `amazon-bedrock-multi-agent`.

**Escala por celda (relativa a cada dimensión, no “nota escolar”):**

| Símbolo | Significado |
|---------|-------------|
| **Alta** | Primera clase en esa dimensión para ese enfoque |
| **Media** | Cubierto con huecos o depende de implementación |
| **Baja** | No es foco del diseño o requiere mucho trabajo ad hoc |

**Fecha:** 2026-03-28.

---

## 1. Tabla maestra por dimensión (12 filas × 7 columnas)

Leyenda columnas: **BMC** = nuestro sistema documentado en el repo.

| Dimensión | **BMC / Panelin** | **OpenAI Swarm / Agents SDK** | **CrewAI** | **Microsoft AutoGen** | **LangGraph (+ supervisor)** | **Google ADK** | **Amazon Bedrock multi-agent** |
|-----------|-------------------|-------------------------------|------------|-------------------------|------------------------------|----------------|--------------------------------|
| **1. Orquestación explícita** (orden de pasos conocido y repetible) | **Alta** — pasos 0→9, tabla Orquestador | **Alta** — handoffs + rutinas ligeras | **Alta** — process secuencial/jerárquico | **Media** — depende de GroupChatManager y política de habla | **Alta** — grafo explícito | **Alta** — workflow agents | **Alta** — supervisor/collaborators gestionado |
| **2. Catálogo de especialistas** (roles con responsabilidad clara) | **Alta** — §2 + skills/agents | **Media** — por diseño del dev | **Alta** — role/goal/backstory | **Media** — agentes conversables | **Media** — subagentes definidos por dev | **Alta** — árbol de agentes | **Alta** — agentes de dominio |
| **3. Preflight / contrato de run** (antes de gastar tokens en todo) | **Alta** — Run Scope Matrix + MATPROMT 0a | **Media** — manual en cliente | **Media** — planning opcional / config crew | **Baja–Media** — no siempre formal | **Media–Alta** — estado inicial del grafo | **Media–Alta** — composición workflow | **Media** — plantillas cloud |
| **4. Estado y memoria entre pasos** | **Media** — Markdown + git + reportes (disciplina humana) | **Baja–Media** — Swarm stateless entre calls; SDK puede persistir según uso | **Media** — memoria/caché de crew | **Media** — historial de chat | **Alta** — checkpoint/persistencia nativa | **Media–Alta** — según despliegue Agent Engine | **Alta** — servicios managed + observabilidad |
| **5. Handoffs / routing entre agentes** | **Alta** — tabla de handoffs + SIM | **Alta** — primitivo central | **Alta** — delegación entre agentes | **Alta** — mensajes y speaker policy | **Alta** — edges condicionales | **Alta** — jerarquía padre-hijo | **Alta** — colaboración supervisor |
| **6. Evaluación de calidad del run** | **Alta** — Judge + criterios por rol + histórico | **Baja** — BYO | **Media** — callbacks / outputs | **Baja–Media** — BYO | **Media** — telemetría + diseño del grafo | **Media** — ops en cloud | **Alta** — monitoring AWS |
| **7. Human-in-the-loop / gates** | **Alta** — gates cm-0/1/2, Matias en 0, UserProxy análogo | **Media** — según app | **Media** — human input según flujo | **Alta** — UserProxyAgent patrón nativo | **Alta** — nodos humanos en grafo | **Media** — según diseño | **Media–Alta** — políticas enterprise |
| **8. Integración con sistema real** (API, DB, Sheets, deploy) | **Alta** — repo + `server/` + `AGENTS.md` + smoke | **Media** — tools a codificar | **Alta** — tools | **Alta** — ejecución código (UserProxy) | **Media** — tools en nodos | **Media–Alta** — conectores GCP | **Alta** — ecosistema AWS |
| **9. Control de coste / profundidad** (evitar trabajo inútil) | **Alta** — Profundo/Ligero/N/A + R1–R4 | **Baja–Media** — responsabilidad del dev | **Media** — configuración crew | **Baja–Media** — rounds máx, políticas | **Media** — diseño del grafo | **Media** — workflow | **Media** — cuotas cloud |
| **10. Autonomía desatendida** (“corre solo hasta el fin”) | **Baja** — **por diseño** (Cursor + gates) | **Media–Alta** — según app | **Alta** — enfoque típico demo | **Media–Alta** | **Alta** — runner largo | **Alta** — cloud | **Alta** |
| **11. Auditabilidad / trazabilidad documental** | **Alta** — STATE, bundles, reportes versionados | **Baja–Media** — logs app | **Media** | **Baja–Media** | **Media** | **Media** | **Alta** — cloud audit |
| **12. Portabilidad sin vendor** (el “equipo” vive en tu repo) | **Alta** — Markdown + Cursor | **Alta** — open source cliente | **Alta** — OSS | **Alta** — OSS | **Alta** — OSS | **Media** — inclinación GCP | **Baja** — AWS |

### Lectura rápida del cuadro

- **BMC gana** en: **preflight contractual** (3), **evaluación explícita del run** (6), **control de profundidad** (9), **auditabilidad git-first** (11), **portabilidad del playbook** (12) *para este proyecto*.
- **BMC pierde de forma intencional** en **autonomía desatendida** (10): no es bug; es **riesgo operativo** si OAuth/Meta/correo corrieran solos.
- Los stacks **cloud** (Bedrock, ADK hosted) ganan en **persistencia/observabilidad** nativa (4, 6, 11 en entorno enterprise) a cambio de **vendor** y coste.

---

## 2. Profundización por sistema (1 párrafo cada uno)

### 2.1 BMC / Panelin (nuestro)

Sistema **document-first**: el Orquestador define un **pipeline** 0→9; **MATPROMT** fija el contrato por rol; **Run Scope Gate** evita simulación de trabajo; **Judge** cierra el ciclo con criterios publicados; **paso 9** enlaza con PROMPT y backlog para la **siguiente iteración**. La integración con **Calculadora, API, Sheets, Cloud Run** es **nativa** al monorepo. El punto débil estructural es la **persistencia**: depende de **commits** y disciplina; no hay motor de grafo ni base transaccional del run (a diferencia de LangGraph/Bedrock).

### 2.2 OpenAI Swarm / Agents SDK

Enfoque **mínimo** en handoffs entre agentes con tools; muy útil para prototipos. No incluye por sí mismo **estado de proyecto empresarial** ni **juez** ni **matriz de alcance**; eso queda en la aplicación. **Alineación con BMC:** mismas ideas de **handoff** y **agente con tools**; falta el capa **governance** que BMC ya tiene en docs.

### 2.3 CrewAI

Muy cercano mentalmente a **crew = §2**, **tasks = PROMPT/paso 9**, **agents = roles**. Fuerte en **delegación** y procesos. La **evaluación** no es tan explícita como el **Judge** de BMC salvo que se construya. **Alineación:** alto; **diferencia:** BMC no ejecuta Python crew en runtime, ejecuta **convenciones** en el IDE.

### 2.4 Microsoft AutoGen

Excelente para **conversación multi-agente** y **UserProxy**; el **speaker auto** puede ser impredecible frente al **orden fijo** de BMC (trade-off: flexibilidad vs auditoría). **Alineación:** buena para **human-in-the-loop**; menos para **checklist de deploy** predecible sin diseño adicional.

### 2.5 LangGraph + supervisor

El más cercano a un **motor de flujo** con **estado** y **ciclos**. BMC **replica el concepto** en papel (bucle paso 9→0) pero **sin ejecutor** único. Si algún día se quisiera automatizar runs, LangGraph sería **referencia de implementación**, no reemplazo del significado de §2.

### 2.6 Google ADK

**Jerarquía + workflow** (sequential/parallel/loop) mapea bien a **0b Parallel/Serial** y al **bucle** de definición FULL-TEAM. Fuerte cuando el destino es **Vertex**; BMC es **agnostic** pero con **Google Sheets** en el centro del negocio.

### 2.7 Amazon Bedrock multi-agent

Patrón **enterprise**: supervisor, colaboradores, observabilidad. **BMC** ya tiene **supervisor + colaboradores + Judge** en el **plano documental**; la diferencia es **runtime managed** vs **Cursor + humano**.

---

## 3. ¿Estamos corriendo OK? (veredicto)

### 3.1 Criterios “saludables” para *este* proyecto

| Criterio | ¿BMC lo cumple si se sigue la doc? |
|----------|-------------------------------------|
| Ningún rol §2 olvidado en un R1 formal | **Sí** — §2.1 + matriz |
| Objetivo del run explícito antes de trabajo caro | **Sí** — paso 0 + MATPROMT + FULL-TEAM-RUN-DEFINITION |
| No gastar en profundidad donde no aporta | **Sí** — RUN-SCOPE-GATE |
| Evidencia antes de marcar gates humanos | **Sí** — HUMAN-GATES |
| Integración con código y prod verificable | **Sí** — AGENTS.md, smoke, gates |
| Cierre de ciclo con mejora (Judge + paso 9) | **Sí** — si no se saltean pasos 6 y 9 |
| Documentación enlazada post-run | **Sí** — 7b + STATE |

### 3.2 Riesgos si “corren mal” (no es el diseño, es la ejecución)

| Riesgo | Síntoma | Mitigación ya documentada |
|--------|---------|---------------------------|
| **Full team sin matriz** | Informes largos vacíos | RUN-SCOPE-GATE + SESSION §1.1 |
| **Saltear 0a MATPROMT** | Roles sin contrato | INVOQUE + Orquestador |
| **STATE desactualizado** | Drift entre agentes | Regla PROJECT-TEAM §3 |
| **Confundir R2 con R1** | Sin artefactos de cierre | RUN-MODES R1–R4 |
| **Autonomía donde hay gate humano** | Cumplimiento / seguridad | AGENTS.md + HUMAN-GATES |

### 3.3 Veredicto en una frase

**Sí: el diseño BMC está alineado con buenas prácticas de equipos multi-agente *empresariales* (supervisión, contrato, estado, evaluación, human loop) y es *superior* a muchos demos genéricos en gobernanza y coste; no intenta ganar en *autonomía desatendida*, y eso es correcto para Panelin.**

---

## 4. Matriz de decisión: ¿cuándo mirar otro framework?

| Si la necesidad es… | Acción recomendada |
|---------------------|-------------------|
| Mejor **playbook** y **menos tokens** | Reforzar **RUN-SCOPE** + **R1–R4** (ya está) |
| **Runner automático** 24/7 sin IDE | Estudiar **Bedrock** o **Agents SDK** *aparte*; no sustituir STATE |
| **Estado transaccional** del workflow | Evaluar **LangGraph** solo como motor interno futuro |
| **Chat multi-agente ad-hoc** | Patrones **AutoGen** como inspiración UX |
| **Equipo comercial en Cursor** | Seguir **SIM/PANELSIM** + handoff MATPROMT |

---

## 5. Referencias cruzadas en el repo

| Documento | Rol |
|-----------|-----|
| [`IMPLEMENTATION-REPORT-BMC-PANELIN.md`](./IMPLEMENTATION-REPORT-BMC-PANELIN.md) | Mapa equivalencias + recomendaciones P0–P3 |
| [`README.md`](./README.md) | Índice de frameworks |
| [`../FULL-TEAM-RUN-DEFINITION.md`](../FULL-TEAM-RUN-DEFINITION.md) | Definición del ciclo BMC |
| [`../PROJECT-TEAM-FULL-COVERAGE.md`](../PROJECT-TEAM-FULL-COVERAGE.md) | §2 roles, §4 propagación |

---

## 6. Descargo

Comparación **cualitativa** basada en documentación pública y en los README de esta KB; no sustituye evaluación legal, de seguridad ni benchmark numérico de latencia/costo.
