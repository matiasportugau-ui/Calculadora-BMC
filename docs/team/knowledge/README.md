# Knowledge base por miembro del equipo

Cada archivo en esta carpeta es la **base de conocimiento** de un rol: entradas/salidas, convenciones, handoffs y referencias. El agente que invoca ese rol puede leer el archivo correspondiente para mayor consistencia y expertise.

## Convención de nombres

- `Mapping.md` — Mapa (Planilla & Dashboard Mapper)
- `Design.md` — Vista (Dashboard Designer)
- `Networks.md` — Red
- `SheetsStructure.md` — Estructura
- `Dependencies.md` — Grafo
- `Integrations.md` — Integra
- `GPTCloud.md` — Nube
- `Fiscal.md` — Fiscal
- `Billing.md` — Cierre
- `AuditDebug.md` — Audit
- `Reporter.md` — Reporte
- `Orchestrator.md` — Orquestador
- `Contract.md` — Contrato
- `Calc.md` — Calc
- `Security.md` — Seguridad
- `Judge.md` — Juez
- `ParallelSerial.md` — Paralelo
- `MATPROMT.md` — MATPROMT (prompts por full team run, paso 0a)
- `RepoSync.md` — RepoSync

## Contenido mínimo por archivo

1. **Entradas:** Qué artefactos y datos debe leer antes de trabajar.
2. **Salidas:** Qué produce (docs, logs, actualizaciones).
3. **Convenciones:** Reglas fijas (ej. plan antes de implementar, solo payloads canónicos).
4. **Handoffs:** A quién escribe Log for X; formato esperado.
5. **Referencias:** Links a PROJECT-STATE, planilla-inventory, JUDGE-CRITERIA, etc.

Ver `FULL-TEAM-IMPROVEMENT-ANALYSIS.md` para el plan completo. Los primeros a rellenar: Mapping, Design, Dependencies, Reporter, Orchestrator.
