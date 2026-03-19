# Chat interactivo con el equipo completo

**Propósito:** Tener un diálogo conversacional con el equipo BMC/Panelin, en lugar de ejecutar un full team run en batch.

---

## Cómo activarlo

Di una de estas frases en el chat de Cursor:

| Frase | Activa |
|-------|--------|
| **Chat con el equipo** | Modo chat interactivo |
| Diálogo interactivo con el equipo completo | Modo chat interactivo |
| Conversar con el equipo | Modo chat interactivo |
| Team chat | Modo chat interactivo |
| Quiero hablar con el equipo | Modo chat interactivo |

---

## Qué puedes hacer en modo chat

1. **Preguntar** — Haz preguntas sobre cualquier área del proyecto (Sheets, Dashboard, Infra, Integraciones, Fiscal, Billing, etc.).
2. **Consultar a roles específicos** — "¿Qué opina Design sobre la jerarquía de Finanzas?" o "¿Networks recomienda Cloud Run o VPS para el deploy?"
3. **Seguir la conversación** — Puedes hacer seguimiento sin que se ejecute un full run completo.
4. **Pedir coordinación** — "Mapping y Design: ¿cómo integraríamos la nueva tab Pagos_Pendientes?"

---

## Diferencia con "Invoque full team"

| | Chat interactivo | Invoque full team |
|---|-----------------|-------------------|
| **Activador** | "Chat con equipo", "diálogo interactivo" | "Invoque full team", "equipo completo" |
| **Comportamiento** | Conversación: preguntas y respuestas | Ejecución batch: pasos 0→9 |
| **Duración** | Continúa mientras sigas preguntando | Una corrida completa |
| **Uso típico** | Consultas, dudas, coordinación puntual | Sincronización, ciclo de mejoras, run completo |

---

## Miembros del equipo (para referenciar en el chat)

Ver `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §2 para la lista completa. Algunos ejemplos:

- **Mapping** — Planillas, interface map, cross-reference
- **Design** — UX/UI, jerarquía, estados loading/error
- **Networks** — Hosting, migración, endpoints, storage
- **Fiscal** — Fiscaliza operaciones, alternativas
- **Billing** — Errores facturación, duplicados, cierre
- **Reporter** — Planes Solution/Coding
- **Orchestrator** — Coordinación, handoffs

---

## Referencias

- **Regla Cursor:** `.cursor/rules/chat-equipo-interactivo.mdc`
- **Equipo completo:** `docs/team/INVOQUE-FULL-TEAM.md`
- **Cobertura:** `docs/team/PROJECT-TEAM-FULL-COVERAGE.md`
