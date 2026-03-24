# Mantenimiento del Mac — fuera del alcance del producto

Este repositorio es principalmente **Calculadora BMC / Panelin** (código, API, dashboard, Sheets). Algunos archivos tocan tu **máquina local** (launchd, limpieza de disco, rutas en `~/Library`). Eso **no** es lógica de negocio ni producción del producto.

## Cómo no mezclarlo mentalmente

| Ámbito | Qué es | Dónde suele vivir |
|--------|--------|-------------------|
| **Producto** | Código, tests, `server/`, `src/`, docs de Sheets/API | Este repo, sin rutas fijas a tu home |
| **Host / personal** | LaunchAgents, scripts que solo corren en tu Mac, umbrales de espacio, auditoría de `plist` | `~/Library/LaunchAgents/`, `~/.cache/`, scripts opcionales |

Si solo te importa el desarrollo del producto: podés **ignorar** o borrar de tu copia local los docs de “LaunchAgents” y el script `audit-launchagents-matias.sh`; no afectan el build ni el deploy del app.

## Qué sirve para **reducir CPU, memoria, energía, disco y red** (sin tocar código)

Prioridad **alta impacto / bajo riesgo** si no usás esas apps:

1. **Desactivar autostart** (`launchctl unload`) de: juegos y launchers (uTorrent, Epic, Sandbox, MEGA updater, Atlas updater si no usás la app), **después** de confirmar que no los necesitás al arrancar.
2. **`com.user.autopilot.monitor.plist`:** `KeepAlive` + intervalo corto + script en bucle; puede ser **constante** en CPU/memoria. Revisá si seguís queriendo ese daemon; si no: `unload` y renombrar o archivar `~/.autopilot/`.
3. **`com.mercado.auto.plist`:** si el job falla o no tenés script `mercado-auto`, desactivá el job para evitar spawns y npm inútiles (red + logs).
4. **Dropbox plists vacíos:** borrar los dos archivos vacíos; no aportan nada.
5. **MongoDB / PostgreSQL (Homebrew):** si no son tu stack diario, no cargues los servicios; ahorrás RAM y puertos (red local).
6. **Disco:** `drive-cleanup` solo cuando el espacio libre esté bajo el umbral; no es “parte del producto”, es comodidad de tu Mac.

**Malintencionado:** no es lo mismo que “pesado”. Para software desconocido: revisar firma (`codesign`), origen del instalador, y no ejecutar scripts de `~/` sin leerlos. Si algo sospechoso, desinstalar app + quitar plist + `launchctl unload`.

## Nada en automático sin tu permiso (launchd)

macOS **no** pregunta “¿permitir?” por cada ejecución de un LaunchAgent. La forma de implementar “solo cuando yo quiero” es **no cargar** esos jobs (unload, archivar o borrar el `plist`) y usar **lista blanca** para lo que sí puede persistir. Guía paso a paso: [MAC-LAUNCHD-MANUAL-ONLY-POLICY.md](./MAC-LAUNCHD-MANUAL-ONLY-POLICY.md).

## Herramientas útiles en el repo (opcionales, host)

- [`scripts/audit-launchagents-matias.sh`](../scripts/audit-launchagents-matias.sh) — lista plists; **no** va a producción. Podés copiarlo a `~/bin/` si preferís que no viva junto al proyecto.
- [`scripts/mac-launchagents-unload-blocklist.sh`](../scripts/mac-launchagents-unload-blocklist.sh) + [`scripts/mac-launchagents-blocklist.example.txt`](../scripts/mac-launchagents-blocklist.example.txt) — `bootout`/`unload` por lista; opción `ARCHIVE=1` para mover plists a `~/Library/LaunchAgents-disabled`. Ver [MAC-LAUNCHD-MANUAL-ONLY-POLICY.md](./MAC-LAUNCHD-MANUAL-ONLY-POLICY.md) sección E.
- [`LAUNCHAGENTS-AUDIT-REPORT.md`](./LAUNCHAGENTS-AUDIT-REPORT.md) — informe puntual; **no** es documentación de API ni de Sheets.

## Si querés aislarlo del repo

1. Copiá `scripts/audit-launchagents-matias.sh` a `~/bin/` (o `~/Documents/mac-tools/`).
2. En tu repo, podés borrar localmente `docs/LAUNCHAGENTS-AUDIT-REPORT.md` y este archivo si no querés verlos en el árbol del proyecto (no hace falta commitear esa borrada si no querés).

---

**Resumen:** accedé a la información para saber qué es tuyo y qué es ruido; la limpieza de recursos es **en el sistema**, no en el código del producto, salvo que explícitamente toques el proyecto (p. ej. ruta del repo en un plist).
