# Dashboard Design — Reference (Best Practices & Time-Saving)

## Similar dashboards to research

- **Operational / Ops dashboards:** Next steps, deliveries, audit logs; tables with row actions (view, edit, complete); filters by date, status, responsible.
- **Finance / back-office:** KPI cards at top; tables (pagos, vencimientos) with sort/filter; clear “pending” vs “done” states; export or print.
- **Quote / sales pipeline:** List or kanban of opportunities; status progression; one-click “convert” or “mark delivered”; minimal form for quick edit.
- **Admin over spreadsheets-as-DB:** Replace raw sheet view with custom UI; same data via API; buttons that trigger backend (e.g. move row, update status).

Use web search or existing knowledge for current patterns (density, spacing, tables vs cards, mobile). Prioritize: **clarity**, **fewest clicks**, **obvious next action**.

## Layout patterns that save time

| Pattern | Use when | Time-saving |
|--------|----------|-------------|
| **Table + row actions** | List of items (entregas, pagos, cotizaciones) | Act per row without opening detail page |
| **KPI strip above list** | Finanzas, resumen | See totals without scrolling |
| **Filters + default view** | Many rows | Reduce noise; “this week” or “my items” as default |
| **Modal / side panel for edit** | Single-row edit (fecha, estado, notas) | Edit in place, no navigation |
| **Sticky header + fixed actions** | Long tables | Always-visible actions and column headers |
| **One-click primary action** | Marcar entregado, aprobar | Single click + confirm when destructive |

## Aesthetic checklist (without sacrificing function)

- Typography: clear hierarchy (title, section, body); readable size and line height.
- Density: enough whitespace to scan; avoid cramming; group related controls.
- Color: use for status (e.g. pending = amber, done = green) and emphasis, not decoration.
- Consistency: same button style, table style, and spacing across sections (Operaciones, Finanzas, Ventas).

## Alignment with BMC

- **Sheets as DB:** UI reads/writes via API; no raw iframe of the sheet. See DASHBOARD-FRONT-VISION.
- **Sections:** Inicio, Cotizaciones, Operaciones, Finanzas, Ventas, Invoque Panelin (IA.md). Design per section; reuse patterns.
- **Actions:** Costeo de venta, Administrar Venta, Marcar entregado, etc. — each as a clear control (button/link) with feedback.
