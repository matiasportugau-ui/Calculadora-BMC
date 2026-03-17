# Knowledge — Security (Seguridad)

Rol: Security Reviewer. Skill: `bmc-security-reviewer`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `server/tokenStore.js`, `server/config.js` — tokens, config.
- `.env.example` — variables documentadas (sin valores).
- `server/index.js`, `server/routes/shopify.js` — headers, HMAC.

---

## Salidas (qué produce)

- **Reporte de hallazgos** — alto/medio/bajo.
- **Recomendaciones** — sin implementar cambios destructivos sin aprobación.
- **Checklist pre-deploy** — OAuth, tokens, env, CORS, HMAC.

---

## Convenciones

- **No modificar producción** sin aprobación explícita.
- **Reportar** hallazgos; recomendar sin implementar destructivo.
- **Áreas:** OAuth state, token storage, .env, CORS, webhook HMAC, headers.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Hallazgos que afectan Integrations | Integrations | Log for Integrations. |
| Hallazgos críticos | Orquestador | Reporte; decisión. |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Security)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Skill: `.cursor/skills/bmc-security-reviewer/SKILL.md`
