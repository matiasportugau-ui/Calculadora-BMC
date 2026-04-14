# Backlog de mejoras por agente — Hasta equipo completamente desarrollado

**Estado 2026-03-20:** ✅ **Todos los roles §2 desarrollados** (incl. **MATPROMT**). Solo mantenimiento: actualizar knowledge cuando cambie el dominio; completar reference.md y examples.md donde falten.

**Alta 2026-03-28:** Nuevo rol §2 **Docs & Repos Organizer** (`bmc-docs-and-repos-organizer`). KB: [`knowledge/DocsOrganizer.md`](./knowledge/DocsOrganizer.md). Skill: [`reference.md`](../.cursor/skills/bmc-docs-and-repos-organizer/reference.md); `examples.md` opcional / N/A.

**Nota 2026-03-27:** Run **55** — **Invoque full team 0→9** ejecutado (artefactos `MATPROMT-RUN-2026-03-27-run55`, Parallel/Serial, REPORT, SIM-REV delta, Judge, Repo Sync, STATE, PROMPT, `MATPROMT-FULL-RUN-PROMPTS`). **Cierre operativo** run 55 (WA/ML/ingest, 503 cotizaciones, MATRIZ, push) sigue sujeto a evidencia humana — [`RUN55-OPERATOR-CHECKLIST.md`](./RUN55-OPERATOR-CHECKLIST.md).

**Propósito:** Cada agente se considera **completamente desarrollado** cuando cumple todos los criterios de su fila. Cada run del Equipo completo ejecuta los **prompts** pendientes (ver `PROMPT-FOR-EQUIPO-COMPLETO.md`) y actualiza este backlog. Se repite hasta que todos estén ✓.

---

## Criterio: agente completamente desarrollado

Por agente deben cumplirse:

| Criterio | Descripción |
|----------|-------------|
| **KB** | Existe `docs/team/knowledge/<Rol>.md` con Entradas, Salidas, Convenciones, Handoffs, Referencias. |
| **reference** | Cada skill del rol tiene `reference.md` (alcance, artefactos, criterios). |
| **examples** | Si aplica, el skill tiene `examples.md` con al menos un caso concreto (o se documenta "N/A"). |
| **SKILL** | SKILL.md referencia su knowledge: "Antes de trabajar, leer `docs/team/knowledge/<Rol>.md` si existe." |
| **Judge** | El rol está en `JUDGE-CRITERIA-POR-AGENTE.md` (ya aplica a todos). |

---

## Estado por agente (✓ = desarrollado)

| Rol | KB | reference | examples | SKILL ref KB | Estado |
|-----|----|-----------|----------|--------------|--------|
| Mapping | ✓ | ✓ (google-sheets) | ✓ | ✓ | Desarrollado |
| Design | ✓ | ✓ | ⬜ | ✓ | Desarrollado |
| Networks | ✓ | ✓ | ✓ | ✓ | Desarrollado |
| Dependencies | ✓ | ✓ | ⬜ | ✓ | Desarrollado |
| Integrations | ✓ | ✓ | ⬜ | ✓ | Desarrollado |
| GPT/Cloud | ✓ | parcial | ✓ (openai) | ✓ | Desarrollado |
| Fiscal | ✓ | ✓ | ✓ | ✓ | Desarrollado |
| Billing | ✓ | ✓ | ✓ | ✓ | Desarrollado |
| Audit/Debug | ✓ | cloudrun ✓ | ⬜ | ✓ | Desarrollado |
| Reporter | ✓ | ✓ | ⬜ | ✓ | Desarrollado |
| Orchestrator | ✓ | — | — | ✓ | Desarrollado |
| Contract | ✓ | ✓ | ⬜ | ✓ | Desarrollado |
| Calc | ✓ | ✓ | ⬜ | ✓ | Desarrollado |
| Security | ✓ | ✓ | ⬜ | ✓ | Desarrollado |
| Judge | ✓ | ✓ | ⬜ | ✓ | Desarrollado |
| Parallel/Serial | ✓ | ✓ | ⬜ | ✓ | Desarrollado |
| Repo Sync | ✓ | ⬜ | ⬜ | ✓ | Desarrollado |
| Docs & Repos Organizer | ✓ | ✓ | ⬜ | ✓ | Desarrollado (examples N/A o futuro) |
| Sheets Structure | ✓ | ✓ | ✓ | ✓ | Desarrollado |
| SIM | ✓ | doc `panelsim/AGENT-SIMULATOR-SIM.md` | N/A | ⬜ | En desarrollo (protocolo Cursor) |
| SIM-REV | ✓ | doc `panelsim/AGENT-SIMULATOR-SIM.md` | N/A | ⬜ | En desarrollo (`panelsim/reports/SIM-REV-REVIEW-*.md`) |
| RoofPlan Architect | ✓ | ✓ | ⬜ | ✓ | Desarrollado |

**Leyenda:** ✓ hecho | ⬜ pendiente | — N/A o ya cubierto por agent .md

---

## Orden sugerido de desarrollo (por run)

1. **Design, Dependencies, Reporter, Orchestrator** (muchos handoffs).
2. **Networks, Integrations, GPT/Cloud, Fiscal, Billing, Audit/Debug** (referencia + knowledge).
3. **Sheets Structure, Contract, Calc, Security, Judge, Parallel/Serial, Repo Sync, Docs & Repos Organizer.**

---

## Cómo actualizar este backlog tras cada run

- Al final del paso 9 (Improvement cycle), el Orquestador o el agente que ejecutó cada prompt marca ✓ en la fila correspondiente.
- Si un criterio no aplica (ej. examples para un rol muy estable), se escribe "N/A" y se considera cumplido.
- Cuando todos los roles de §2 tienen todos los criterios ✓ o N/A, el equipo se considera **completamente desarrollado** y el run de mejoras puede pasarse a "mantenimiento" (solo actualizar knowledge cuando haya cambios de dominio). **N** = filas §2 (ver PROJECT-TEAM-FULL-COVERAGE §2.1).
