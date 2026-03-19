# Chat de Equipo Interactivo — Diálogo con el equipo BMC/Panelin

**Propósito:** Permitir un diálogo conversacional con el equipo completo. A diferencia del "Invoque full team" (run secuencial), aquí podés hacer preguntas, recibir respuestas y seguir la conversación.

---

## Cómo activar

| Frase | Activa |
|-------|--------|
| **Chat con el equipo** | Modo diálogo interactivo |
| Diálogo interactivo con el equipo | Modo diálogo interactivo |
| Quiero hablar con el equipo | Modo diálogo interactivo |
| Conversar con el equipo completo | Modo diálogo interactivo |
| Interactive team chat | Modo diálogo interactivo |

---

## Qué hace

1. **Carga el skill** `.cursor/skills/chat-equipo-interactivo/SKILL.md`
2. **Lee** `docs/team/PROJECT-STATE.md` para contexto
3. **Responde** en formato conversacional según tu pregunta
4. **Invoca** solo los roles relevantes al tema (Mapping, Design, Networks, etc.)
5. **Permite seguimiento** — podés hacer más preguntas, pedir aclaraciones o cambiar de tema

---

## Ejemplos de uso

**Preguntar estado:**
> "¿Cómo está el estado del proyecto?"

**Consultar un rol:**
> "¿Qué opina Design sobre la sección de entregas?"

**Preparación para deploy:**
> "¿Estamos listos para deploy? ¿Qué falta?"

**Tema específico:**
> "¿Cómo está la integración con Shopify?"

**Seguimiento:**
> "Explícame más sobre eso" / "¿Y qué dice Networks?"

---

## Diferencia con "Invoque full team"

| Aspecto | Chat interactivo | Invoque full team |
|---------|------------------|-------------------|
| **Modo** | Conversacional, multi-turn | Run secuencial 0–9 |
| **Objetivo** | Preguntas, aclaraciones | Ejecución completa |
| **Roles** | Solo los relevantes | Todos los 19 |
| **Output** | Respuesta en prosa | Artefactos, PROJECT-STATE actualizado |

---

## Referencias

- **Skill:** `.cursor/skills/chat-equipo-interactivo/SKILL.md`
- **Rule:** `.cursor/rules/chat-equipo-interactivo.mdc`
- **Invoque full team:** [INVOQUE-FULL-TEAM.md](./INVOQUE-FULL-TEAM.md)
- **Equipo completo:** [PROJECT-TEAM-FULL-COVERAGE.md](./PROJECT-TEAM-FULL-COVERAGE.md) §2
