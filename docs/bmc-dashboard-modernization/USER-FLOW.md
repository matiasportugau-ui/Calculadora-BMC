# BMC Dashboard — User flow (Cotizaciones ↔ Operaciones / Finanzas)

Short description of how data and actions move between the Cotizaciones (Calculadora), Operaciones, and Finanzas sections.

---

## 1. From quote building to Operaciones and Finanzas

1. **User builds a quote** in **Cotizaciones** (Calculadora at http://localhost:5173): configures paneles, zonas, escenario; gets BOM and total. Optionally saves to Google Drive or exports PDF/WhatsApp.
2. **Quote data** (when formalized or synced) lives in **Master_Cotizaciones** or **CRM_Operativo** (Google Sheet), according to `BMC_SHEET_SCHEMA`.
3. **Operaciones** (at `/finanzas`, section #operaciones) reads the same Sheet:
   - **Próximas entregas** — rows with `ESTADO` confirmado/pendiente and `FECHA_ENTREGA` in the current week (API: `/api/proximas-entregas`).
   - **Coordinación logística** — same rows with WhatsApp-ready message (API: `/api/coordinacion-logistica`).
   - **Audit log** — from sheet `AUDIT_LOG` (API: `/api/audit`).
4. **Finanzas** (at `/finanzas`, section #finanzas) also reads from Sheets:
   - **KPIs financieros** — from `Pagos_Pendientes` and `Metas_Ventas` (API: `/api/kpi-financiero`, `/api/pagos-pendientes`, `/api/metas-ventas`).
   - Cotizaciones that become “pending payment” or feed into metas are reflected here via the same data model.

So: **Cotizaciones (builder)** produces or feeds data that **Operaciones** and **Finanzas** consume from the same Sheets via the BMC Dashboard API.

---

## 2. Marcar entregado → Ventas realizadas

1. In **Operaciones**, the user sees **Próximas entregas** and can trigger **“Marcar entregado”** for a row (POST `/api/marcar-entregado` with `cotizacionId`).
2. The backend:
   - Appends that row to the sheet **“Ventas realizadas y entregadas”** (with delivery date and comments).
   - Removes the row from **Master_Cotizaciones**.
3. That completed sale is then part of **Ventas** (data); the **Ventas** section in the dashboard (placeholder today) will eventually show or report on “Ventas realizadas.”

So: **Operaciones** “marcar entregado” moves a row from Master to **Ventas realizadas**, linking Operaciones to the Ventas universe.

---

## 3. Summary diagram (conceptual)

```
[Cotizaciones: Calculadora 5173]  →  (save/sync)  →  Master_Cotizaciones / CRM_Operativo
                                                              ↓
                                    /api/proximas-entregas, /api/coordinacion-logistica, /api/audit
                                                              ↓
[Operaciones: /finanzas#operaciones]  ←  Próximas entregas, Coordinación logística, Audit log
                                                              ↓
                                    POST /api/marcar-entregado (marcar entregado)
                                                              ↓
[Ventas realizadas y entregadas]  ←  row moved from Master

[Finanzas: /finanzas#finanzas]  ←  /api/kpi-financiero, /api/pagos-pendientes, /api/metas-ventas
                                   (Pagos_Pendientes, Metas_Ventas, same Sheet ID)
```

---

## References

- [IA.md](./IA.md) — sections and nav.
- [DASHBOARD-VISUAL-MAP.md](./DASHBOARD-VISUAL-MAP.md) — API and data flow.
- [context-briefs/](./context-briefs/) — per-module detail.
