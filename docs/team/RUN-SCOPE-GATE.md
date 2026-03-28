# Run Scope Gate — Orientar el full team y ahorrar recursos

**Propósito:** Que cada **Invoque full team** arranque con **objetivo claro**, **matriz de profundidad por rol** y **orden/paralelo** acordes — sin “simular” trabajo costoso en áreas que **no aportan** al caso.

**No sustituye:** La tabla canónica de roles en `PROJECT-TEAM-FULL-COVERAGE.md` §2. En un full team, **ningún rol se borra del run**; lo que se evita es ejecutar **pasos profundos innecesarios**.

---

## Roles responsables (quién decide qué tanto correr cada agente)

| Quién | Cuándo | Qué hace |
|-------|--------|----------|
| **Orquestador (paso 0)** | Al disparar el run | Fija **objetivo del run** en 1–3 frases; propone **matriz de alcance** (Profundo / Ligero / N/A) con **una línea de justificación** por rol; marca §2.2 transversales aplicables o N/A. |
| **MATPROMT (paso 0a)** | Justo después | Incorpora la matriz en el **bundle** (cabecera **«Run Scope Matrix»**); para roles en **Ligero** o **N/A**, los prompts exigen **solo** cierre breve (ver abajo), no auditorías completas. |
| **Parallel/Serial (paso 0b)** | Con bundle o borrador de matriz | Orden **paralelo vs serie** y clones **respetando** dependencias; puede sugerir **reclasificar** un rol a Ligero si el objetivo es muy acotado (con acuerdo del Orquestador). |
| **Matias / usuario** | Si el objetivo es ambiguo | Responde **Preguntas abiertas** del bundle antes de pasos caros (Mapping, código, audit largo). |

No hace falta un agente §2 nuevo: el **filtrado** es responsabilidad compartida **Orquestador + MATPROMT + Parallel/Serial**, documentada en este archivo.

---

## Modos de ejecución por rol (definiciones)

| Modo | Significado | Coste típico |
|------|-------------|----------------|
| **Profundo** | Trabajo real del skill: lecturas, artefactos, riesgos, handoffs. | Alto |
| **Ligero** | Solo **cierre explícito**: 1–3 bullets — qué revisó, **por qué no hay delta**, qué vigilar en el próximo run si cambia X. | Bajo |
| **N/A (justificado)** | No aplica al objetivo; **una frase** de motivo + **riesgo** si se asume algo falso (ej. “no validamos OpenAPI este run”). | Mínimo |

**Regla:** Para **Ligero** y **N/A**, está prohibido inventar hallazgos o “rellenar” informes largos. Si surge duda de negocio, el rol pasa a **Profundo** o escala al Orquestador.

---

## Plantilla: Run Scope Matrix (copiar al inicio del bundle MATPROMT o al `PARALLEL-SERIAL-PLAN`)

```markdown
## Run Scope Matrix — RUN YYYY-MM-DD / runN

**Objetivo del run (usuario):** …

| Rol §2 | Modo (Profundo / Ligero / N/A) | Justificación (1 línea) |
|--------|--------------------------------|-------------------------|
| Mapping | | |
| Design | | |
| … | | |

**§2.2 Transversales:** (aplicable / N/A + por qué)

**Roles que NO deben abrir herramientas pesadas** (ej. audit full, smoke prod, corpus ML): lista explícita.
```

El Orquestador puede rellenar un **borrador** en paso 0; MATPROMT lo **congela** o ajusta en 0a; Parallel/Serial lo **cita** en 0b.

---

## Criterios para marcar Ligero o N/A (ahorro con criterio)

- **N/A razonable:** El `PROJECT-STATE` y el objetivo del usuario **no mencionan** el dominio del rol (ej. run solo docs → Billing N/A; run solo MATRIZ UI → Fiscal N/A salvo que haya riesgo explícito).
- **Ligero razonable:** El área **puede** verse afectada pero **no hubo cambios** desde el último run documentado; el rol confirma “sin delta” y señala **un** riesgo residual.
- **Profundo obligatorio:** Hay pendiente abierto en STATE/PROMPT que nombra ese rol; el usuario pidió explícitamente esa área; o el rol es **cadena crítica** para el handoff siguiente (ej. Mapping antes de Contract si hay duda de columnas).

**Judge (paso 6)** sigue evaluando el run; los roles en Ligero/N/A deben quedar **claros en el bundle** para que el Judge no penalice “falta de informe” donde hubo **N/A acordado**.

---

## Relación con pasos ya definidos (Orquestador)

- **2b, 4b, 5c, 5e, 5g, 5h, 7b:** ya son **condicionales**; la matriz los hace **explícitos** desde el minuto cero.
- **Paso 9:** solo los roles con ítems en “Próximos prompts” necesitan ejecución profunda; el resto N/A en paso 9 salvo que el PROMPT diga lo contrario.

---

## Referencias

- `docs/team/INVOQUE-FULL-TEAM.md`
- `.cursor/agents/bmc-dashboard-team-orchestrator.md`
- `.cursor/skills/matprompt/SKILL.md`
- `.cursor/skills/bmc-parallel-serial-agent/SKILL.md`
- `docs/team/MATPROMT-FULL-RUN-PROMPTS.md` (plantilla de bundle)
- `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §2.1–2.2
