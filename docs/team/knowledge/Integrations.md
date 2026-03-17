# Knowledge — Integrations (Integra)

Rol: Integrations. Skills: `shopify-integration-v4`, `browser-agent-orchestration`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `server/routes/` — rutas Shopify, ML, OAuth.
- Si existe: `tokenStore.js`, `shopifyStore.js` — estado de tokens.
- Tabla de propagación §4 — cambios en webhooks afectan Networks.

---

## Salidas (qué produce)

- **OAuth 2.0 / PKCE:** Flujos Shopify, MercadoLibre.
- **Webhooks:** Validación HMAC, sync a Google Sheets.
- **Admin UI:** Lista de preguntas, respuestas sugeridas, one-click approve & send.
- **Log for Networks:** Si hay cambios de webhooks o callbacks que afectan infra.

---

## Convenciones

- **HMAC:** Validar antes de procesar body en webhooks.
- **Scopes mínimos:** Solo los necesarios; nunca añadir sin necesidad explícita.
- **LATAM/Uruguay:** Formateo de respuestas en español.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Cambios en OAuth redirect o webhooks | Networks | Log for Networks; PROJECT-STATE. |
| Cambios que afectan UI de admin | Design | Log for Design. |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Integrations)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Skill: `.cursor/skills/shopify-integration-v4/SKILL.md`
