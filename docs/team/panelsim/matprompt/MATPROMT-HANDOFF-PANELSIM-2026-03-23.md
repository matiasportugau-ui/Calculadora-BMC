# Handoff a SIM / PANELSIM — ejecutado 2026-03-23

**Tipo:** Cierre operativo del bloque “Invoque full team tema PANELSIM” (síntesis + pruebas), no reemplaza un run 0→9 completo numerado.

**Documento canónico:** [`../AGENT-SIMULATOR-SIM.md`](../AGENT-SIMULATOR-SIM.md)

---

## 1. Lecturas confirmadas

| Artefacto | Estado |
|-----------|--------|
| `docs/team/PROJECT-STATE.md` | Fuente de estado; ver Cambios 2026-03-23 (PANELSIM). |
| `docs/team/SESSION-WORKSPACE-CRM.md` | Cockpit sesión; actualizar fecha al usar. |
| `docs/team/panelsim/AGENT-SIMULATOR-SIM.md` | Visión PANELSIM, §0.1 arranque, modos aprobación/automático. |
| `docs/google-sheets-module/README.md` + `planilla-inventory.md` | Inventario 5 workbooks + tabs runtime. |

---

## 2. Conexiones verificadas (runtime local)

| Recurso | Base / ruta | Resultado 2026-03-23 |
|---------|-------------|----------------------|
| Calculadora GPT entry | `GET /calc/gpt-entry-point` | **200** — `data_version` presente. |
| Capabilities / manifiesto | `GET /capabilities` | **200** (manifiesto completo). |
| CRM cotizaciones (Sheets) | `GET /api/cotizaciones` | **200** — `ok: true`, **297 filas** en `data` (headers canónicos CRM_Operativo). |
| KPI financiero / pagos | `GET /api/kpi-financiero` | **200** — `ok: true`, estructura con `pendingPayments`, `calendar`, `byPeriod`, `metas`, etc. |
| KPI report | `GET /api/kpi-report` | **200** |
| Stock e-commerce | `GET /api/stock-ecommerce` | **200** |
| Próximas entregas | `GET /api/proximas-entregas` | **200** — `data` vacío en este momento (sin filas pendientes o filtro). |
| Mercado Libre — preguntas | `GET /ml/questions` | **401** — `OAuth not initialized. Complete /auth/ml/start flow first.` |
| Mercado Libre — estado OAuth | `GET /auth/ml/status` | **404** en esta ruta según prueba; cuerpo alternativo vía flujo: *no token stored* hasta `/auth/ml/start`. |

**Implicación PANELSIM:** Cotización y lectura de **dashboard/Sheets vía API** operativas en local con `.env` actual. **ML pendientes** requieren completar OAuth en `http://localhost:3001/auth/ml/start` antes de listar o responder preguntas.

---

## 3. Handoff a SIM — checklist (copiar al chat)

| Path / URL | Vigente |
|------------|---------|
| API local | `http://localhost:3001` |
| Calc | `POST /calc/cotizar`, `POST /calc/cotizar/pdf`, `GET /calc/gpt-entry-point` |
| Planillas (hub) | `docs/google-sheets-module/README.md` |
| Informe situación | [`../reports/PANELSIM-SHEETS-SITUATION-2026-03-23.md`](../reports/PANELSIM-SHEETS-SITUATION-2026-03-23.md) |
| ML OAuth | `/auth/ml/start` antes de `/ml/questions` |

**Pendientes que SIM no debe inventar:** IDs de sheet están en `planilla-inventory` y `config`; Pista 3 tabs/triggers manual sigue en `PROJECT-STATE` / `SOLUCIONES-UNO-POR-UNO`.

---

## 4. Próximo paso sugerido

1. Matias: abrir OAuth ML si se necesitan **consultas pendientes** desde API.
2. Opcional: **SIM-REV** tras cambios grandes → `docs/team/panelsim/reports/SIM-REV-REVIEW-YYYY-MM-DD.md`.
