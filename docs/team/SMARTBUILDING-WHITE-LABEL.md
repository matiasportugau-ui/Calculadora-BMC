# Tenant SmartBuilding — deploy paralelo (2026-08-18)

Igual que Jenerik/BC y Paneles LAM: BMC es dueño del SaaS; SmartBuilding corre
**su** calculadora. Los tenants son independientes: matriz, counter, telemetry,
avatar y proyecto Vercel no se comparten.

| | |
|---|---|
| URL | https://calculadora-smartbuilding.vercel.app |
| Proyecto Vercel | `calculadora-smartbuilding` (`prj_1w6kABpNLkBITBlU5nYMXP6cIYW8`) |
| `VITE_WHITELABEL` | `smartbuilding` |
| Admin | `/hub/admin/tenant/smartbuilding` |
| Códigos | `SMART-YYYY-NNNN` (counter propio) |
| Avatar IA | `public/video/panelin-smartbuilding-loop.mp4` (exclusivo; no se usa en BC/LAM/BMC) |
| Agente | **Basuuuu IA** — transcripciones + tokens en `/hub/admin/tenant/smartbuilding` tab IA (eval) |

No toca `calculadora-bmc`, `calculadora-bc` ni `calculadora-paneleslam`.

Owner: pendiente de mail. Cuando llegue:

```bash
npm run jenerik:grant -- EMAIL smartbuilding
```
