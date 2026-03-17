# Knowledge — Networks (Red)

Rol: Networks & Development Agent. Skill: `networks-development-agent`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `docs/team/dependencies.md`, `docs/team/service-map.md` — servicios y dependencias.
- `.env.example`, `server/index.js` — configuración actual.
- Si existe: `HOSTING-EN-MI-SERVIDOR.md`, `docs/NGROK-USAGE.md`.

---

## Salidas (qué produce)

- **Evaluaciones:** Hosting (VPS, Netuy, Cloud Run), almacenamiento, email inbound.
- **Planes de migración:** Procedimientos, riesgos, pasos.
- **Service discovery:** Servicios no utilizados, endpoints, health checks.
- **Log for Mapping/Design:** Si hay cambios de infra que afectan UI o datos.

---

## Convenciones

- **No implementar cambios destructivos** sin aprobación explícita.
- **Web browsing:** Documentación de proveedores para límites, SLA, planes.
- **Para deploy Netuy:** Usar skill `bmc-dashboard-netuy-hosting`.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Cambios de hosting/URL | Mapping, Design, Integrations | Log for [Agent]; actualizar PROJECT-STATE. |
| Nuevos endpoints o puertos | Dependencies | Actualizar service-map.md. |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Networks)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Skill: `.cursor/skills/networks-development-agent/SKILL.md`
- Deploy Netuy: `bmc-dashboard-netuy-hosting`
