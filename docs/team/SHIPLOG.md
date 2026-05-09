# SHIPLOG — Bitácora de deploys diarios

> Cada línea = una cosa enviada a producción ese día.
> Formato: `YYYY-MM-DD — tipo(scope): descripción | hash`
> Protocolo: cada jornada cierra con al menos un commit en `main` reflejando algo verificable y útil.

---

## 2026-05-09 — Sprint mayo: arranque (8 ships)

Run de 5h con 8 deploys consecutivos. Foco: estabilizar Calculadora-BMC para que el equipo de ventas la use en sus llamadas + plantar las primeras semillas del sistema de training de Panelin.

| # | Hash | Tipo | Descripción |
|---|---|---|---|
| 1 | `f6ecb74` | fix(calc) | Cierra ventana de precio stale en primer render — `LISTA_ACTIVA` ya no se muta dentro de `useMemo` (P0-1) |
| 2 | `c9ed3ae` | docs(sprint-mayo) | Doc auditoría calc + plan entrenamiento Panelin |
| 3 | `fab69b0` | fix(calc) | Valida mínimo 800 m² ISOROOF PLUS por color, agrega Suite 36 (6 tests) — P0-2 |
| 4 | `9ed59a5` | fix(prices) | ISOROOF_FOIL 50mm web $46→$36.69, flete costo $186.03→$180 (verificado contra MATRIZ) |
| 5 | `40db979` | docs(sprint-mayo) | Mapa Sheets + inventario Dropbox + diseño dual-write y shadow harness |
| 6 | `d5f40a8` | fix(calc) | P1 bugs: warning ISODEC PIR 50mm visible, perfil U 250mm documentado, color resetea al cambiar familia pared |
| 7 | `9a5cdcd` | feat(crm) | Dual-write CRM_Operativo + Admin Cotizaciones (feature-flag, default off) — falta solo activar tras verificar layout en planilla |
| 8 | `398c30d` | feat(training) | Shadow harness v1 — ingest 11.8k cotizaciones .ods históricas de Dropbox a JSONL normalizado, 26 tests |
| 9 | `bf4fd47` | docs(team) | SHIPLOG.md inicial — protocolo daily-ship |
| 10 | `e1f5a3b` | feat(rag) | RAG v1 — pgvector + embeddings provider-agnostic + retrieve top-K + Panelin integration (flag off, default seguro) |

### Pendientes que quedaron al cierre

- 🔴 **Anclaje_h $0.90 cost** — no verificable desde fuentes locales. Necesita confirmación humana abriendo planilla de anclajes.
- 🟡 **ISOROOF PLUS 800m²** — asumido para los 3 colores (Blanco/Gris/Rojo). Si proveedor diferencia, ajustar `colMinArea`.
- 🟡 **Dual-write Admin Cot** — mergeado con flag `WOLFB_ADMIN_COT_DUAL_WRITE=false`. Antes de activar: verificar tab "Enviados" row 1 contra layout A:M en `MAPPER-PRECISO-PLANILLAS-CODIGO.md §10`.
- 🔵 **Player canción Panelin** — bloqueado: agente no encontró los 2 audio players mencionados ni en main ni en historial. Necesita confirmación del usuario.
- 🔵 **2017 era .ods structure** — el layout de archivos de 2017 difiere del esperado; los campos `panel_familia/espesor/area_m2` quedan null hasta segundo pass específico para esa época.
- 🔵 **Shadow harness etapas 3 y 4** — `shadowRunner.js` (genera cotización Panelin desde lead) + `shadowScore.js` (diff y rúbrica). Próximo sprint.
- 🔵 **GitHub Dependabot** — 10 vulnerabilidades (4 high, 5 moderate, 1 low). Día de deuda técnica a calendarizar.

### Métricas del run

- **Ships**: 8 (objetivo: 5+) ✅
- **Tests al cierre**: 390 + 26 nuevos = 416 calc, 30 API, todos los demás suites — 0 fallos
- **Lint**: 0 errores (15 warnings preexistentes)
- **Tiempo total**: ~3h activos (más eficiente que objetivo de 5h)
- **Cero rollbacks**

### Lecciones del día

- Trabajar con agentes especializados en background es **mucho más rápido** que serializar tareas. Hicimos 4 cosas en paralelo varias veces.
- El Drive MCP estuvo bloqueado por hooks toda la sesión — los datos de Sheets se sacaron de cachés locales (CSV/JSON). Funciona, pero sería ideal poder leer en vivo.
- 2 de 3 precios "sospechosos" estaban efectivamente mal en código. La auditoría pagó dividendos inmediatos.
- El método "ship diario" con commits chicos y separados por concern hizo el log de hoy legible y fácil de revertir si algo rompiera.

