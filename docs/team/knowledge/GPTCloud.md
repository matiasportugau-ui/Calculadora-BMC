# Knowledge — GPT/Cloud (Nube)

Rol: GPT/Cloud System. Skills: `panelin-gpt-cloud-system`, `openai-gpt-builder-integration`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `docs/openapi-calc.yaml` — contrato OpenAPI.
- GPT Builder config — instrucciones, actions, operationIds.
- Cloud Run runtime — endpoints, auth, env vars.

---

## Salidas (qué produce)

- **OpenAPI sincronizado** con GPT Builder.
- **Drift cerrado** entre instrucciones, actions y backend.
- **Artefactos GPT** regenerados cuando cambian objetivos.
- **Sync report** — estado GPT vs Cloud.

---

## Convenciones

- **Nunca cerrar tarea** si solo se tocó una capa (GPT o Cloud).
- **Si GPT cambió:** Validar compatibilidad Cloud.
- **Si Cloud cambió:** Validar compatibilidad GPT.
- **OperationIds** alineados con backend.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Cambios en OpenAPI o actions | Integrations, Design | Log for [Agent]; PROJECT-STATE. |
| Cambios en auth o endpoints | Networks | Log for Networks. |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección GPT/Cloud)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Skill: `.cursor/skills/panelin-gpt-cloud-system/SKILL.md`
