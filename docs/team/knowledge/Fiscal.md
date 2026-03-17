# Knowledge — Fiscal

Rol: Oversight & Efficiency. Skill: `bmc-dgi-impositivo` (base) + rol de fiscalización.

---

## Entradas (leer antes de trabajar)

- `docs/team/PROJECT-STATE.md` — cambios recientes, pendientes.
- `docs/team/fiscal/FISCAL-PROTOCOL-STATE-RANKING.md` — ranking de criticidad.
- Tabla de propagación §4 — incumplimientos → Log for [Agent], Orquestador si Crítico/Alto.
- Cuando aplica impositivo: DGI, CFE, facturación, datos bancarios.

---

## Salidas (qué produce)

- **Fiscalización:** Auditoría de operaciones del equipo.
- **Alternativas:** Análisis con cada compañero para ahorrar energía, tiempo, dinero.
- **Hallazgos al Orquestador:** Oportunidades de optimización.
- **Log for [Agent]:** Si detecta incumplimiento de protocolo PROJECT-STATE.
- **Impositivo (cuando aplica):** Conciliación IVA/IRAE/IP, vistas Art. 46, descargos.

---

## Convenciones

- **No inventar** normativa, montos ni estados.
- **Diferenciar** hechos verificados vs hipótesis.
- **Comunicar** a involucrados para que no pase de nuevo.
- **Escalar** al Orquestador si Crítico/Alto.

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Incumplimiento protocolo | Agente involucrado | Log for [Agent]. |
| Crítico/Alto | Orquestador | Reporte; decisión o propagación. |
| Errores fiscales detectados | Billing, Mapping | Si afecta datos. |

---

## Referencias

- Criterios del Juez: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección Fiscal)
- Propagación: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §4
- Protocolo: `docs/team/fiscal/FISCAL-PROTOCOL-STATE-RANKING.md`
- Skill: `.cursor/skills/bmc-dgi-impositivo/SKILL.md`
