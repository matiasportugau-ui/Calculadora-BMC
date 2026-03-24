# MATPROMT — Tema de run: Agente Simulador (SIM) + SIM-REV

**Fecha:** 2026-03-23  
**Tipo:** Plantilla de **paso 0a** cuando el objetivo del Equipo completo es **asistir a SIM** (Cursor) con información y conexiones actualizadas, y dejar preparado el **revisor SIM-REV**.

**Documento canónico:** [`../AGENT-SIMULATOR-SIM.md`](../AGENT-SIMULATOR-SIM.md) (incluye visión **PANELSIM**: cotizaciones + admin BMC, ML pendientes, modos aprobación/automático, arranque full team → informe Sheets).

---

## Objetivo del run (declarar en paso 0)

1. Que exista una **matriz de conexiones** verificada (repo + API + docs + opcional MCP), incluyendo rutas **ML** (`/ml/questions`, OAuth) e **Integrations** donde aplique.
2. Que cada rol §2 **entregue o confirme** los artefactos que SIM/PANELSIM lee (sin drift nuevo).
3. Que **MATPROMT** emita un **Handoff a SIM/PANELSIM** al final del bundle: lista de paths/URLs vigentes + recordatorio de modo aprobación por defecto para respuestas ML.
4. Que **SIM-REV** tenga criterio claro para el informe `docs/team/panelsim/reports/SIM-REV-REVIEW-YYYY-MM-DD.md`.
5. *(Opcional post-run)* Que el usuario pueda generar **informe situación Sheets** (`docs/team/panelsim/reports/PANELSIM-SHEETS-SITUATION-*.md`) si credenciales y API lo permiten.

---

## Prompts orientadores por rol (resumen)

| Rol | Enfoque en este tema |
|-----|----------------------|
| **Orchestrator** | Marca “objetivo SIM” en paso 0; agenda paso 5h SIM-REV si aplica. |
| **MATPROMT** | Incluye subsecciones “Para SIM” en cada rol; cierra con Handoff a SIM. |
| **Parallel/Serial** | Paraleliza Contract+Calc+Mapping si no hay bloqueo. |
| **Mapping** | Inventario Sheets + interface map coherentes para respuestas que citen planillas. |
| **Dependencies** | `service-map` / grafo con puertos 3001/5173 y entrypoints API. |
| **Contract** | Contrato API alineado con `planilla-inventory` y `/capabilities`. |
| **Networks** | `PUBLIC_BASE_URL`, Cloud Run/Vercel para links PDF y GPT. |
| **GPT/Cloud** | OpenAPI + Builder sin drift respecto a `server/routes/calc.js`. |
| **Calc** | Rutas `/calc/*`, PDF, texto WhatsApp documentados en respuesta JSON. |
| **Security** | `.env`, CORS, tokens — sin secretos en chat SIM. |
| **Reporter** | Si hay plan de implementación, mencionar impacto en checklist SIM. |
| **SIM** (implícito) | No es paso separado: es el consumidor del Handoff en Cursor. |
| **SIM-REV** | Ejecutar revisión §4 de AGENT-SIMULATOR-SIM.md → reporte en `docs/team/panelsim/reports/`. |
| **Judge** | Puede incorporar calidad del Handoff a SIM como criterio opcional del run. |

---

## Handoff a SIM (plantilla — completar al cierre del bundle)

```markdown
## Handoff a SIM — RUN YYYY-MM-DD

- PROJECT-STATE leído: sí / no
- API local: `npm run start:api` → base URL: ___
- Capabilities: GET /capabilities verificado: sí / no
- Sheets hub: README + mapper enlazados sin contradicción: sí / no
- OpenAPI vs código: revisado por Contract: sí / no
- Pendientes que SIM no debe inventar: (lista corta)
```

---

## Próximo paso

Fusionar este tema en `MATPROMT-FULL-RUN-PROMPTS.md` bajo un bundle nombrado (ej. «Bundle — Tema SIM / YYYY-MM-DD») cuando se ejecute un run numerado con este foco.
