# BMC Dashboard — Information Architecture

Single source of truth for the **BMC Dashboard** (the product) and its sections. See also [DASHBOARD-VISUAL-MAP.md](./DASHBOARD-VISUAL-MAP.md) for technical architecture.

---

## Product name and scope

- **BMC Dashboard** = the whole product (single main business frontend). Use “BMC Dashboard” or “Dashboard” only for this product.
- **Finanzas** = section at `/finanzas`: KPIs, pagos pendientes, metas de ventas (and Operaciones blocks on the same page).
- **Operaciones** = section (same app as Finanzas): próximas entregas, coordinación logística, audit log.
- **Cotizaciones** = section: quote builder (Calculadora) + list/admin of quotes. Not “data only” (Master_Cotizaciones is the data source; “Cotizaciones” in nav = section).
- **KPI** = sub-area of **Finanzas** (no separate top-level section).
- **Calculadora component (canonical):** In repo, the component in use is `src/components/PanelinCalculadoraV3.jsx` (Drive + Budget Log); `App.jsx` imports it directly. The previous `_backup` filename was renamed to its canonical name and the unused `_legacy_inline` monolith was removed in the 2026-04-30 refactor. Docs and map reference the canonical name where needed.

---

## Primary entry URL

- **Local:** `http://localhost:3001` — root `GET /` redirects to `/finanzas` for browser requests.
- **With ngrok:** Use the ngrok HTTPS URL (e.g. `https://xxx.ngrok-free.app`); same server, tunnel to port 3001. See [NGROK-USAGE.md](../NGROK-USAGE.md) for URL/port mapping, front (Vite) vs API (Express), and traffic interpretation (200/404).
- **Favicon and root:** `GET /favicon.ico` returns 204. Dashboard page at `/finanzas` has its own favicon.

---

## Section hierarchy (top-level nav)

| Section | Purpose | Target today |
|--------|---------|--------------|
| **Inicio** | Overview / home | Same page (top) or dashboard root |
| **Cotizaciones** | Create and manage quotes | Calculadora at http://localhost:5173 (dev) |
| **Operaciones** | Entregas, logística, audit | Anchor #operaciones on /finanzas |
| **Finanzas** | Pagos, metas, KPI financiero | Anchor #finanzas on /finanzas |
| **Ventas** | Pipeline, Ventas 2.0 (planned) | Placeholder #ventas |
| **Invoque Panelin** | GPT-powered assistant (planned) | Placeholder #invoque |

KPI is **under Finanzas** (not a top-level item).

---

## User flow (short)

- From **BMC Dashboard** (3001 or ngrok), open **Cotizaciones** → link to Calculadora (5173) to build quotes.
- Quotes feed Master_Cotizaciones / CRM; **Operaciones** and **Finanzas** views at `/finanzas` read from the same Sheets.
- “Marcar entregado” (Operaciones) moves a row to “Ventas realizadas y entregadas.”

---

## Invoque Panelin (hybrid)

- **Standalone:** Top-level nav item “Invoque Panelin” (Link → Panelin Evolution (3847) con funcionalidad GPT completa).
- **Transversal:** Future entry points in Cotizaciones, Operaciones, Finanzas (e.g. “Ask Panelin” in header or per section).

---

## Estrategia dual de dashboards

**Mantener ambas opciones:** BMC Dashboard (3001) = vista principal con toda la funcionalidad actual. Panelin Evolution (3847) = Invoque Panelin funcional. Standalone (3849) = alternativa.

**Visión a futuro:** El nuevo dashboard debería replicar **completamente** la funcionalidad de las planillas de Google Sheets a través de la interfaz. Mientras tanto, la versión actual es suficiente.

---

## 3849 vs 3001/finanzas

- **Canonical view for Operaciones/Finanzas:** `http://localhost:3001/finanzas` (static dashboard served by the main Express server). Use this as the primary URL when running the full stack (`npm run dev:full` or API + dashboard).
- **Port 3849** (`npm run bmc-dashboard`): runs `docs/bmc-dashboard-modernization/sheets-api-server.js`, a **standalone** server that can serve a similar or older dashboard when the main API (3001) is not running. For normal use, prefer **3001/finanzas** so one entry (3001) serves both API and dashboard.

---

## References

- [USER-FLOW.md](./USER-FLOW.md) — detailed flow Cotizaciones ↔ Operaciones/Finanzas and marcar entregado.
- [FULL-IMPROVEMENT-PLAN.md](./FULL-IMPROVEMENT-PLAN.md) — step-by-step improvement plan.
- [02-investigation-and-discussion.md](./02-investigation-and-discussion.md) — gaps, dependencies, resolutions.
- [context-briefs/](./context-briefs/) — per-module universe briefs; [05-universe-invoque-panelin.md](./context-briefs/05-universe-invoque-panelin.md) has transversal entry points spec.
- [PANELIN-EVOLUTION-FLOW.md](../team/PANELIN-EVOLUTION-FLOW.md) — flujo completo (proxy 3848, viewer 3847, collector), fallback respuesta rápida, troubleshooting.
