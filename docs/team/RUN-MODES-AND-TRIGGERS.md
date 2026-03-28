# Modos de RUN, triggers y comunicación al equipo

**Propósito:** Responder con precisión si *«full team es full team»*, describir **cómo está conformado el equipo §2**, y definir **qué debe correr siempre**, **qué solo cuando hace falta**, y **cómo encargárselo a los agentes** sin ambigüedad.

**Relacionado:** [`FULL-TEAM-RUN-DEFINITION.md`](./FULL-TEAM-RUN-DEFINITION.md) (**definición maestra** del ciclo Full Team), [`RUN-SCOPE-GATE.md`](./RUN-SCOPE-GATE.md) (Profundo / Ligero / N/A), [`INVOQUE-FULL-TEAM.md`](./INVOQUE-FULL-TEAM.md), [`PROJECT-TEAM-FULL-COVERAGE.md`](./PROJECT-TEAM-FULL-COVERAGE.md) §2.

---

## 1. ¿«Full team» es full team?

**Sí en cobertura, no en coste uniforme.**

| Qué promete el repo | Qué *no* promete |
|---------------------|------------------|
| Que **cada rol §2** quede **considerado** en el run (nadie olvidado en la lista canónica). | Que **cada rol** haga una **auditoría profunda** en cada corrida. |
| Que exista **trazabilidad**: incluso N/A lleva **una línea** de motivo y riesgo si aplica. | Que el orden 2→5g se ejecute siempre con la misma **intensidad**. |

Por eso el nombre puede confundir: **«Equipo completo» = equipo completo en el papel + Run Scope Matrix**, no «veintitantos informes largos siempre». Si preferís lenguaje interno: **«Full coverage run»** o **«Run §2 con matriz»**.

---

## 2. Cómo está conformado el equipo (dos capas)

### 2.1 Capa A — Filas §2 (`PROJECT-TEAM-FULL-COVERAGE.md`)

Son **roles con nombre** que el Judge puede rankear y que tienen paso o handoff en el orquestador (salvo **SIM**, que es modo Cursor; ver abajo).

**N** = número de filas de la tabla §2 (dinámico; no fijar «19» o «22» en texto vivo).

### 2.2 Capa B — Skills transversales §2.2

Son **protocolos** (AI Interactive Team, Project Team Sync, ML API, etc.): no reemplazan una fila §2; en paso 0 se marca **aplicable** o **N/A este run**.

### 2.3 SIM / PANELSIM (caso especial)

**SIM** está en §2 pero **no** es un paso lineal 0–9: se alimenta del **Handoff a SIM** en el bundle MATPROMT y de `PROJECT-STATE`. La ejecución es el **chat Cursor** según [`panelsim/AGENT-SIMULATOR-SIM.md`](./panelsim/AGENT-SIMULATOR-SIM.md).

---

## 3. Tipos de RUN (elegí uno al arrancar)

| Modo | Cuándo usarlo | Qué implica para agentes |
|------|----------------|---------------------------|
| **R1 — Full coverage (Invoque full team)** | Cierre de sprint, release, cambios que tocan varias áreas, o run numerado en PROMPT. | Pasos 0→9 del orquestador; **Run Scope Matrix** obligatoria; todos §2 con Profundo/Ligero/N/A. |
| **R2 — Sync documental** | Solo estado y brújula; sin delta técnico grande. | `PROJECT-STATE` + `project:compass` / `channels:onboarding`; **no** sustituye R1 si hace falta MATPROMT/Judge. |
| **R3 — Slice / parcial** | Objetivo acotado (ej. «solo Contract + Networks tras deploy»). | Orquestador ejecuta **solo** pasos necesarios; igualmente conviene **mini matriz** con roles no invocados = N/A «run parcial R3». |
| **R4 — Un solo rol** | Bug en Calc, duda de Mapping, etc. | Un skill + contexto; sin prometer cobertura §2. |

**Regla:** Si decís *«Invoque full team»*, por convención del repo activás **R1**. Si querés ahorrar, declará en la misma frase el **modo** o el **objetivo** (ver sección 6).

---

## 4. Qué actúa «siempre» vs «según trigger» (guía práctica)

### 4.1 Siempre en R1 (pipeline de coordinación)

Estos **pasos de meta-equipo** casi nunca son N/A en un full coverage real:

| Pieza | Rol / paso | Por qué |
|-------|------------|--------|
| Lectura de estado | Orquestador **0** | Sin STATE/PROMPT no hay criterio. |
| Bundle y matriz | **MATPROMT 0a** | Es el contrato del run para cada rol. |
| Paralelo/série | **Parallel/Serial 0b** | Evita dependencias rotas y ahorra donde la matriz lo permite. |
| Cierre de ciclo | Orquestador **8–9** | STATE + backlog + próximos prompts. |

### 4.2 Casi siempre en R1, con intensidad variable (Profundo vs Ligero)

| Rol | Profundo típico cuando… | Ligero / N/A típico cuando… |
|-----|-------------------------|------------------------------|
| **Mapping** | Cambió Sheets, CRM, columnas, o hay drift sospechado. | Ningún cambio de datos/schema desde último run documentado. |
| **Dependencies** | Nuevo servicio, ruta API, o deploy. | Solo doc o copy sin arquitectura. |
| **Contract** | Tocaste `bmcDashboard.js` rutas o contrato. | Run solo markdown. |
| **Networks** | Cloud Run, env, CORS, URLs, secretos mount. | No hubo movimiento de infra. |
| **Integrations** | ML, Shopify, webhooks, OAuth. | Run fiscal o solo Calc. |
| **Reporter** | Hay que dejar REPORT/handoff Solution-Coding. | Run solo índice de docs (Reporter puede ser Ligero si no hay entrega a Solution). |
| **Security** | Nuevo token, CORS, exposición. | Run puramente editorial. |
| **GPT/Cloud** | OpenAPI, Builder, drift. | No tocó GPT/Actions. |
| **Fiscal / Billing** | Hay ítem en STATE/PROMPT o cierre de mes. | Run técnico UI sin impacto fiscal. |
| **Audit/Debug** | Post-deploy, incidente, «audit a fondo». | Run documental; matriz marca «sin herramientas pesadas». |
| **Calc** | MATRIZ, 5173, BOM, precios. | No hubo cambio calculadora. |
| **Judge** | Fin de R1 con artefactos. | (Raramente N/A en R1 formal.) |
| **Repo Sync** | Tenés paths hermanos configurados y hubo delta. | Sin segundo repo o sin cambios a espejar. |
| **Docs & Repos Organizer** | Hubo nuevos `docs/` o reportes. | Sin delta documental (N/A explícito). |

### 4.3 Solo si trigger explícito

| Rol / paso | Trigger |
|------------|---------|
| **Sheets Structure (2b)** | Cambio estructural de tabs/validaciones; **Matias**. |
| **SIM-REV (5h)** | Objetivo del run incluye PANELSIM / backlog SIM (ver `AGENT-SIMULATOR-SIM`). |
| **SIM** | Sesión Cursor + handoff 0a; no es paso batch. |
| **§2.2 ML API** | Run toca ML, `mercadoLibreClient`, OAuth, `/ml/*`. |

---

## 5. Evaluar la tarea (checklist rápida para el Orquestador)

Antes de escribir la matriz, responder:

1. **¿Qué archivos o dominios cambiaron** desde el último run citado en STATE? (código API, Sheets, OpenAPI, solo docs…)
2. **¿Qué pendiente en PROMPT o STATE nombra un rol?** Ese rol → **Profundo** salvo acuerdo explícito.
3. **¿Hay riesgo de seguridad o prod?** → Security + Networks + Audit suben prioridad.
4. **¿Es solo para el asistente Cursor?** → Reforzar Handoff SIM en 0a; 5h si aplica.

Si la respuesta es «no toca X» y no hay riesgo residual, **Ligero o N/A** con una línea.

---

## 6. Cómo comunicarle a los agentes (plantillas)

### 6.1 Una frase para R1 con ahorro

```text
Invoque full team (R1). Objetivo: […]. Run Scope: Profundo en [roles]; Ligero en [roles]; N/A en [roles] salvo que encuentres bloqueo. Respetá RUN-SCOPE-GATE.md y dejá la matriz en el bundle MATPROMT.
```

### 6.2 Orden parcial (R3)

```text
Run parcial R3: solo pasos [ej. 3b Contract + 3c Networks + 8]. Motivo: [deploy / smoke falló]. El resto de §2: N/A «run parcial» en un bloque al final.
```

### 6.3 Un solo rol (R4)

```text
Solo rol [Calc / Mapping / …]. Contexto: [link o path]. No es full team; no hace falta matriz §2 completa.
```

---

## 7. Mejores prácticas para correr el equipo (recomendación operativa)

Estas prácticas alinean el diseño del repo con patrones habituales de orquestación multi-agente (preflight, contrato de run, trazabilidad, ahorro).

### 7.1 Antes de ejecutar nada pesado

1. **Elegir modo de run (R1–R4)** explícitamente; no usar R1 cuando R2 o R4 alcanzan.
2. **Objetivo en 1–3 frases** en chat o en el bundle; si es vago, responder primero las *Preguntas abiertas* del micro-framework MATPROMT.
3. **Run Scope Matrix** antes o al inicio de 0a: evita que roles “rellenen” informes sin aporte.

### 7.2 Durante el run

4. **Respetar el DAG lógico**: Mapping antes de Contract cuando hay duda de columnas; Networks antes de conclusiones de OAuth/URLs si el run toca deploy.
5. **Parallel/Serial** solo para tareas **sin handoff bloqueante** entre sí (ver `PARALLEL-SERIAL-PLAN`).
6. **Ligero/N/A** con **una línea de riesgo** cuando se omite un dominio (ej. “no validamos OpenAPI este run”).
7. **Human gates** (`HUMAN-GATES-ONE-BY-ONE.md`): no marcar hecho sin evidencia en cm-0/1/2.

### 7.3 Cierre y calidad

8. **Judge (paso 6)** en R1 formal: cierra el ciclo de mejora; la matriz acordada evita penalizar N/A injustamente.
9. **Paso 9** solo con prompts reales del `PROMPT-FOR-EQUIPO-COMPLETO`; actualizar backlog y “Próximos prompts” para el siguiente ciclo.
10. **`PROJECT-STATE.md`**: una entrada en Cambios recientes cuando el run cambió hechos o pendientes; no duplicar novelas (SESSION-WORKSPACE-CRM para foco diario).

### 7.4 Separar “documentación” de “código”

11. Run **solo docs** → Contract/Audit/Smoke suelen ser **Ligero/N/A** salvo que el doc afirme comportamiento de API.
12. Tras tocar **`src/`** o rutas API → `npm run gate:local` / `test:contracts` según `AGENTS.md`; la matriz puede marcar **Contract + Security** como Profundo.

### 7.5 Anti-patrones (evitar)

- Invocar *Invoque full team* sin leer **STATE/PROMPT** (paso 0 vacío).
- Omitir **MATPROMT 0a** en un R1 “por ir rápido” (pierde el contrato entre roles).
- Confundir **sync documental (R2)** con **cierre de run numerado (R1)** cuando el PROMPT exige artefactos.
- Exigir a **SIM** el mismo batch que los roles de ingeniería (SIM es sesión Cursor + handoff).

---

## 8. Propuesta de evolución (si el lenguaje molesta)

Si el equipo prefiere claridad sobre marketing:

- Renombrar en docs/comandos la frase **«Invoque full team»** a **«Invoque run §2»** o **«Run cobertura §2»** (cambio de copy en `INVOQUE-FULL-TEAM.md` y reglas Cursor cuando decidan).
- Mantener **«Equipo completo»** para la **tabla de personas/roles**, no para «todos corren pesado».

Este documento no exige renombrar nada; solo documenta la semántica real.

---

## Referencias

- [`RUN-SCOPE-GATE.md`](./RUN-SCOPE-GATE.md)
- [`INVOQUE-FULL-TEAM.md`](./INVOQUE-FULL-TEAM.md)
- [`.cursor/agents/bmc-dashboard-team-orchestrator.md`](../.cursor/agents/bmc-dashboard-team-orchestrator.md)
- [`SESSION-WORKSPACE-CRM.md`](./SESSION-WORKSPACE-CRM.md) — cockpit de sesión
- [`PROJECT-TEAM-FULL-COVERAGE.md`](./PROJECT-TEAM-FULL-COVERAGE.md) §2–§2.2
