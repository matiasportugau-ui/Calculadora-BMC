# Informe de implementación — Equipo de agentes BMC/Panelin vs arquitecturas populares

**Audiencia:** Orquestador, MATPROMT, Matias.  
**Fuente comparativa:** carpeta [`popular-known-ai-teams/`](./README.md) (resúmenes + enlaces oficiales).  
**Repo bajo análisis:** Calculadora-BMC / Panelin (dashboard, API, calculadora, docs de equipo).

**Fecha de redacción:** 2026-03-28.

---

## 1. Resumen ejecutivo

El proyecto **no** usa un framework Python tipo CrewAI/AutoGen/LangGraph en runtime. En su lugar implementa un **sistema documentado de orquestación humana-asistida** en Cursor:

- **Tabla canónica de roles** §2 (`PROJECT-TEAM-FULL-COVERAGE.md`).
- **Orquestador** con pasos 0→9 (`.cursor/agents/bmc-dashboard-team-orchestrator.md`).
- **Contrato por run:** MATPROMT (0a) + **Run Scope Matrix** (`RUN-SCOPE-GATE.md`).
- **Estado y trazabilidad:** `PROJECT-STATE.md`, reportes Judge/Reporter, paso 9 con PROMPT y backlog.
- **Definición del ciclo:** [`FULL-TEAM-RUN-DEFINITION.md`](../FULL-TEAM-RUN-DEFINITION.md).

Esto es **semánticamente cercano** a: **supervisor + pool de especialistas + handoffs + estado persistente + human-in-the-loop**, alineado con las mejores prácticas de equipos multi-agente **empresariales** (gobernanza, evidencia, no alucinar contratos), aunque **no** sea autónomo en el sentido de “un proceso corre solo hasta el fin sin humano”.

---

## 2. Arquitectura actual BMC (referencia interna)

| Capa | Artefactos |
|------|------------|
| **Invocación** | `INVOQUE-FULL-TEAM.md`, skill `bmc-project-team-sync` |
| **Orquestación** | Orquestador: orden 0, 0a, 0b, 1…7b, 8, 9 |
| **Roles** | §2 + skills `.cursor/skills/*` + agents `.cursor/agents/*` |
| **Planificación** | MATPROMT, Parallel/Serial, `RUN-MODES-AND-TRIGGERS.md` (R1–R4) |
| **Evaluación** | Judge + `JUDGE-CRITERIA-POR-AGENTE.md` |
| **Documentación** | Docs & Repos Organizer (7b), hubs `docs/` |
| **Integración real** | API `server/`, Sheets, Cloud Run, `AGENTS.md` comandos |
| **Human gates** | `HUMAN-GATES-ONE-BY-ONE.md` (cm-0/1/2) |

---

## 3. Mapa de equivalencias (patrón popular → BMC)

| Patrón / framework (ver subcarpeta) | Mecanismo típico | Equivalente BMC | Nivel de parecido |
|--------------------------------------|------------------|------------------|-----------------|
| **OpenAI Swarm / Agents SDK** | Handoffs + agentes con tools | Handoffs en orquestador; skills = tools; SIM handoff | Alto (conceptual) |
| **CrewAI** | Crew, tasks, roles | §2 + PROMPT paso 9 + MATPROMT por rol | Alto |
| **AutoGen** | Group chat, speaker policy | Orden fijo + Parallel/Serial; Matias = UserProxy | Medio-alto |
| **LangGraph supervisor** | Grafo, estado, loops | Pasos 0→9 + iteración paso 9; STATE = estado; sin motor de grafo en código | Medio |
| **Google ADK** | Workflow sequential/parallel/loop | Pasos secuenciales + 0b + bucle entre runs | Medio-alto |
| **Bedrock multi-agent** | Supervisor + collaborators + observabilidad | Orquestador + §2 + Judge + smoke/gates | Medio |

---

## 4. Fortalezas frente a “equipos autónomos” genéricos

1. **Fuente de verdad externa al LLM:** planillas, `planilla-inventory`, rutas API reales — reduce alucinación de negocio.
2. **Contrato explícito por run:** Run Scope Matrix + criterios Judge — auditabilidad.
3. **Coste acotado:** Profundo/Ligero/N/A — evita N informes largos inútiles.
4. **Alineación operativa:** `npm run gate:local`, `smoke:prod`, `project:compass` conectan el run con el sistema real.
5. **Escalabilidad organizativa:** alta de roles §2.3, propagación §4, Repo Sync.

---

## 5. Brechas vs “autonomía completa” (literal)

| Ideal “full autonomous” | Realidad BMC | Riesgo si se fuerza autonomía |
|-------------------------|--------------|-------------------------------|
| Runner único ejecuta todos los roles hasta DoD | Cada rol suele ser **invocación de modelo + humano** en Cursor | Pasos incorrectos sin revisión |
| Speaker auto LLM siempre | Orden mayormente **prescriptivo** | Menos flexibilidad, más predecibilidad (deseable aquí) |
| Estado en base del framework | Estado en **Markdown + git** | Requiere disciplina de commit/PR |
| Tools auto-ejecutados sin fricción | Gates **cm-0/1/2**, OAuth ML, secretos | Cumplimiento y seguridad |

**Conclusión:** BMC es **autónomo en la definición del flujo y en la repetición del ciclo**, pero **no** en la ejecución desatendida de acciones sensibles (Meta, OAuth, ingest correo, etc.), lo cual es coherente con `AGENTS.md` y gates humanos.

---

## 6. Recomendaciones de implementación (priorizadas)

### P0 — Sin código, solo disciplina (ya soportado por docs)

- Declarar **objetivo central + DoD** en cada R1 (plantilla `FULL-TEAM-RUN-DEFINITION.md` §8).
- No saltear **0a** ni **matriz** en runs formales.
- Mantener **SESSION-WORKSPACE-CRM** §1.1 checklist antes de *Invoque full team*.

### P1 — Mejora documental / KB (bajo esfuerzo)

- Tras cada run relevante, añadir **una línea** en esta KB si un framework popular cambia de nombre o deprecación (p. ej. Swarm → Agents SDK).
- Opcional: diagrama único en `docs/team/` que una §2 con handoffs (mermaid) inspirado en ADK/LangGraph **solo como visual**, sin nuevo runtime.

### P2 — Automatización parcial (alto esfuerzo, evaluar ROI)

- Script `npm run channels:automated` ya existe para pipeline máquina; **extender** con validación de que existió MATPROMT/bundle en el run (heurística por archivo) si se desea “gate” CI documental.
- **No** recomendado sin diseño previo: empaquetar el orquestador en un runner LangGraph/CrewAI en paralelo al modelo actual — duplicaría fuente de verdad.

### P3 — Investigación futura

- **OpenAI Agents SDK** o **ADK** como *referencia de API* si algún día se expone un “team runner” HTTP interno; hoy el producto es **Cursor + repo**.

---

## 7. Cuadro comparativo multidimensional (industria + BMC)

Ver documento dedicado: [`COMPARATIVE-MATRIX-BMC-VS-INDUSTRY.md`](./COMPARATIVE-MATRIX-BMC-VS-INDUSTRY.md) (12 dimensiones, veredicto de ejecución saludable).

---

## 8. Tabla rápida “¿dónde mirar en el repo?”

| Necesidad | Ruta |
|-----------|------|
| Quién es el equipo | `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §2 |
| Orden del run | `.cursor/agents/bmc-dashboard-team-orchestrator.md` |
| Definición del ciclo | `docs/team/FULL-TEAM-RUN-DEFINITION.md` |
| Ahorro / profundidad | `docs/team/RUN-SCOPE-GATE.md`, `RUN-MODES-AND-TRIGGERS.md` |
| Comparar con industria | `docs/team/popular-known-ai-teams/README.md` |

---

## 9. Descargo

Este informe es **interno** y **no** certifica compatibilidad con productos de terceros. Las marcas (OpenAI, Microsoft, Google, AWS, LangChain, CrewAI) pertenecen a sus titulares.
