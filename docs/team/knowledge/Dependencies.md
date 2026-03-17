# Knowledge — Dependencies (Grafo)

Rol: Dependencies & Service Mapper. Skill: `bmc-dependencies-service-mapper`.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `docs/google-sheets-module/planilla-inventory.md` — tabs y APIs que consumen.
- `docs/bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md` — secciones y fuentes.
- `docs/bmc-dashboard-modernization/dependencies.md` — grafo previo (si existe).
- `docs/bmc-dashboard-modernization/service-map.md` — inventario previo (si existe).

---

## Salidas (qué produce)

- **dependencies.md:** Grafo por módulo; dependencias cruzadas; gaps y riesgos.
- **service-map.md:** Inventario de servicios, entry points, contratos, health checks.
- **Integration checklist:** From → To → Integration → Status.

---

## Convenciones

- **Grafo por módulo:** Cada módulo (Cotizaciones, Operaciones, Finanzas, Ventas, Invoque, Shell) con Depends on (env, APIs, otros).
- **Dependencias cruzadas:** Identificar handoffs entre módulos (ej. Operaciones → Finanzas vía Sheets).
- **Gaps:** Documentar condicionales (Pagos_Pendientes, Metas_Ventas) y mitigaciones.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Cambios en dependencias | Reporter | Log for Reporter (nuevos gaps, riesgos). |
| Cambios que afectan Design | Design | Log for Design (nuevas fuentes, módulos). |
| Cambios en infra o endpoints | Networks | Log for Networks (puertos, URLs). |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Dependencies).
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4.
- Skill: `.cursor/skills/bmc-dependencies-service-mapper/SKILL.md`.
