# HANDOFF — Ingreso y actualización Admin (P0)

**Fecha:** 2026-07-04  
**Branch:** `feat/admin-ingreso-p0`  
**Estado:** Shipped to production (pending merge verification)

---

## Qué se entregó

| Superficie | URL / ruta |
|------------|------------|
| Módulo principal | https://calculadora-bmc.vercel.app/hub/admin-ingreso |
| API chat | `panelin-calc` → `/chat/api/*` |
| Acceso rápido | Pestaña **Respondamos Rapido** → «Abrir módulo completo» |
| Hub | Wolfboard → card verde «Ingreso y actualización Admin» |

**Flujo P0:** lista pendientes → seleccionar fila → chat IA → **Guardar en Admin** (J/K/L) → Siguiente / Cotizaciones.

---

## Documentación

- Design brief: `docs/team/features/INGRESO-ACTUALIZACION-ADMIN-DESIGN-BRIEF.md`
- UX spec: `docs/team/features/INGRESO-ACTUALIZACION-ADMIN-UX-SPEC.md`
- PROJECT-STATE: entrada 2026-07-04 P0 LIVE

---

## Archivos del ship

```
docs/team/features/INGRESO-ACTUALIZACION-ADMIN-*.md
docs/team/PROJECT-STATE.md
docs/team/HANDOFF-2026-07-04-admin-ingreso-p0.md
server/lib/bmcChatSheets.js
src/App.jsx
src/components/AdminIngresoModule.jsx
src/components/admin-ingreso/styles.css
src/components/BmcChatPanel.jsx
src/components/BmcWolfboardHub.jsx
src/hooks/useAdminIngreso.js
src/utils/adminIngresoApi.js
```

---

## Verificación prod

```bash
# Frontend (tras deploy Vercel)
curl -sS -o /dev/null -w "%{http_code}\n" https://calculadora-bmc.vercel.app/hub/admin-ingreso

# API (tras deploy Cloud Run si hubo cambio server)
curl -sS https://panelin-calc-642127786762.us-central1.run.app/chat/api/inquiries
# → 401 sin token (esperado); 200 con Bearer admin JWT
npm run smoke:prod
```

**UAT humano:** login admin → `/hub/admin-ingreso` → fila → chat → Guardar en Admin → ver J/K/L en planilla.

---

## Pendiente (P1 — no en este ship)

- Abrir en calculadora (`bmc_pending_admin_import`)
- Modal cotización → Drive (col M)
- Modo A ingreso rápido / Modo C revisión
- Integrar brain/few-shot del pipeline en interpret

---

## Retomar

> "Continuar P1 de admin-ingreso: precarga calculadora + modal cotización Drive. Leer HANDOFF-2026-07-04-admin-ingreso-p0.md y UX spec §13 fases."