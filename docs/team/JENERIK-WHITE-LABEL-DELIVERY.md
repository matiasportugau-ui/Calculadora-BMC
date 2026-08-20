# Jenerik / BC — merged delivery (2026-08-18)

Tenant SaaS **without** charging, commission, or factory cost in this release.

## Product now

```
BMC (dueño)
  └── tenant BC / Jenerik Bentancor
        ├── owner Jenerik (invita cuentas Google)
        └── users de Jenerik → calc + PDF BC (precios de venta)
```

| Superficie | Cliente | Usuario Jenerik | BMC |
|---|---|---|---|
| PDF | Marca **BC**, P.U. de **venta** (lista BMC por defecto; se puede pisar). Sin BMC/Metalog. | Igual | Copia de venta (totales, m², quién cotizó) |
| Costo fábrica | no | no | no (todavía) |
| Comisión | no | no | no (todavía) |

Logs: `identity.user_activity_log` + `identity.quotes` (sale-only payload). Eso sirve para elegir el modelo de cobro después.

## Qué no es esto

- No mergear **#1051** (`feat/paid-white-label-presupuestos`) a `main`.
- No hay pasarela, no se calcula `comision_usd`, no se guarda `factory_cost`.
- Repo de trabajo: `~/calculadora-bmc-jenerik` branch `feat/jenerik-bc-tenant` (worktree desde `origin/main` + cherry-pick PDF BC).

## Ambiente (sin mail todavía)

## Producción Vercel (aparte de BMC)

Proyecto **`calculadora-bc`** (team `matprompts-projects`). No es
`calculadora-bmc`.

- URL: **https://calculadora-bc.vercel.app**
- Build: `VITE_WHITELABEL=bc`
- `/api` se reescribe al Cloud Run BMC (`panelin-calc`). El counter de
  cotización que se ve arriba sigue siendo el de BMC hasta que haya API
  propia con `WHITELABEL=bc`.
- OAuth (mismo client que BMC, **ADD only**):
  `https://calculadora-bc.vercel.app` ya está en Authorized JavaScript origins
  (URI 8). BMC (`https://calculadora-bmc.vercel.app`) sigue en URI 7.
  Client `642127786762-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3`. Detalle:
  `docs/team/runbooks/google-oauth-troubleshooting.md`.

Owner Jenerik (invite, 2026-08-18): **bc.montajes@gmail.com** (`role=owner`,
pending claim). El primer login Google con esa cuenta en
https://calculadora-bc.vercel.app reclama la invite (equipo + historial).

```bash
cd ~/calculadora-bmc-jenerik
npm run jenerik:migrate
npm run jenerik:grant -- bc.montajes@gmail.com
```

UI BMC (misma instancia):

- `/hub/admin/tenants` — flota (BC, LAM, SmartBuilding): estado, cuentas, venta, eventos, agente IA, tokens 30d
- `/hub/admin/tenant/:slug` — Live / Analytics / **IA (eval)** / Cuentas / Monitor / Control
- `/hub/admin/tenant-bc` redirige a `/hub/admin/tenant/bc`

Agente del socio BC: **JenIA** (nunca Panelin). Transcripciones completas + tokens + USD estimado (eval) en tab IA. Los vendedores no ven costos.

El SPA BC escribe en `/bc-telemetry` (función Vercel de `calculadora-bc`, no Cloud Run). BMC prod no se rebuild-ea. Pausar un tenant no toca a los demás.
