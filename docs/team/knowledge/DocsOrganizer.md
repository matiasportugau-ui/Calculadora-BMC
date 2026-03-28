# Knowledge — Docs & Repos Organizer

**Rol:** §2 **Docs & Repos Organizer** — skill `bmc-docs-and-repos-organizer`, agente `.cursor/agents/bmc-docs-and-repos-organizer.md`.

---

## Entradas

- `AGENTS.md` (raíz): comandos, convenciones, qué no commitear.
- `docs/team/PROJECT-STATE.md`: contexto del run; no editar sin autorización explícita y entrada en Cambios recientes.
- `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §2 y §4: roles y propagación.
- Diff o lista de artefactos del run (reportes, nuevas rutas `docs/…`).
- Opcional: `docs/team/MATPROMT-FULL-RUN-PROMPTS.md` o `matprompt/MATPROMT-RUN-*.md` para rutas citadas.

---

## Salidas

- README u hub actualizado con enlaces a documentos nuevos o movidos.
- Informe breve de gaps: enlaces rotos, duplicados canónico vs obsoleto, comandos desalineados con `package.json`.
- Handoff para **Repo Sync**: lista de paths que deben espejarse en repos hermanos.
- Propuesta de bullet para **Cambios recientes** (solo texto; el Orquestador o el usuario aplica en `PROJECT-STATE` si corresponde).

---

## Convenciones

- Un documento canónico por tema; los demás enlazan o deprecan con una línea.
- No inventar verdad de API, Sheets ni precios; escalar a Contract / Mapping / Calc.
- No escribir secretos; solo nombres de variables como en `.env.example`.
- Cambios masivos de estructura: preferir PR dedicado `docs: …`.

---

## Handoffs

| Hacia | Cuándo |
|-------|--------|
| **Repo Sync** | Tras definir qué archivos bajo `docs/` o `.cursor/` deben replicarse en bmc-dashboard-2.0 / bmc-development-team |
| **Orchestrator** | Pendientes documentales que requieran decisión o línea en PROJECT-STATE |
| **MATPROMT** | Si el bundle del próximo run debe citar rutas nuevas (evitar prompts con paths inexistentes) |

---

## Referencias

- `.cursor/skills/bmc-docs-and-repos-organizer/SKILL.md`
- `.cursor/agents/bmc-docs-and-repos-organizer.md`
- `.cursor/agents/bmc-dashboard-team-orchestrator.md` (paso **7b**)
- `docs/team/README.md`
