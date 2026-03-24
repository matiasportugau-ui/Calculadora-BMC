# LaunchAgents — informe de auditoría

**Alcance:** mantenimiento de **tu Mac** (launchd, rutas locales). **No** es documentación del producto BMC ni API/Sheets. Ver [HOST-MAC-NOT-PRODUCT.md](./HOST-MAC-NOT-PRODUCT.md).

**Fecha:** 2026-03-21  
**Herramienta:** [`scripts/audit-launchagents-matias.sh`](../scripts/audit-launchagents-matias.sh) (`--json` opcional).  
**Plan origen:** `~/.cursor/plans/auditoría_launchagents_macos_104d5796.plan.md`  
**Manifest (cuándo/para qué):** [`scripts/launchagents-manifest.md`](../scripts/launchagents-manifest.md)

**Integración:** El audit de LaunchAgents corre como **paso 10** en `run_audit.sh` (Super Agente BMC / bmc-dashboard-audit-runner), junto con la verificación de **espacio en disco** (mismo paso Host).

**Detecta:**
- **Nuevos** — plists en `~/Library/LaunchAgents/` que no están en la lista conocida
- **Regenerados** — plists que archivamos (en `~/Library/LaunchAgents-disabled/`) y la app los recreó

Este documento resume la fase 2 del plan: validación en disco, scripts custom y decisiones sobre DB y plists residuales.

---

## Resumen ejecutivo

| Tema | Resultado |
|------|-----------|
| `plutil -lint` (16 archivos) | Todos **OK** tras corregir `com.mercado.auto` (ampersands en XML). Si tenías el job cargado: `launchctl unload ~/Library/LaunchAgents/com.mercado.auto.plist && launchctl load ~/Library/LaunchAgents/com.mercado.auto.plist`. |
| `com.bmc.drive-cleanup` | Cargado en `launchctl`; alineado con repo; `RunAtLoad` false. |
| `com.mercado.auto` | Fallo previo: `&&` sin escapar en XML → corregido a `&amp;&amp;`. Log muestra `npm error Missing script: "mercado-auto"` — revisar `package.json` del proyecto o desactivar el job. |
| `com.user.autopilot.monitor` | `KeepAlive` + `StartInterval` 300; script en `~/.autopilot/autopilot_daemon.sh` (bucle `while true`, lockfile, acciones sobre CPU alto en `fileproviderd` / Mail). |
| `com.vmc.lacanplus.daily` | Python envía informes por SMTP (`lacan_plus.yaml` con credenciales); ejecución diaria 09:00. |
| Dropbox `agent` / `xpcservice` | Plists **vacíos** (`<dict/>`). Candidatos a borrar o ignorar. |
| MongoDB / PostgreSQL (Homebrew) | `brew services list`: **none** (no cargados como servicio en esta sesión). Sin listeners activos detectados en el paso de auditoría. |
| Adobe plist | Nombre de archivo `com.adobe.GC.Invoker-1.0.plist` vs **Label** `com.adobe.GC.Scheduler-1.0` (posible renombrado histórico). |

---

## Rankings: uso de recursos vs risk score (16 plists)

**Nota:** Estimación **qualitativa** según `plist` (intervalos, `KeepAlive`, tipo de proceso) y el informe histórico; no es medición en vivo de CPU/RAM. Para medir: Monitor de Actividad, `powermetrics`, `fs_usage`, `nettop`.

**Escala:** **1** = peor posición (mayor impacto o mayor riesgo), **16** = mejor (menor impacto o menor riesgo).

### Metodología — uso de recursos (orden 1–16)

Ponderación aproximada: **CPU** y **RAM** (procesos persistentes, `KeepAlive`, servidores DB) > **red** (P2P, updaters, npm) > **disco** (I/O continuo vs tarea corta) > **energía** (correlate con CPU tiempo activo). Plists **vacíos** no ejecutan nada → fondo de lista.

### Ranking A — impacto potencial de recursos (1 = más alto)

| Rank | Plist | Por qué |
|------|--------|---------|
| 1 | `homebrew.mxcl.postgresql@14.plist` | Servidor DB con `KeepAlive` típico: RAM + disco + socket local si está cargado. |
| 2 | `homebrew.mxcl.mongodb-community.plist` | `mongod` persistente cuando el job está activo. |
| 3 | `com.user.autopilot.monitor.plist` | `KeepAlive` + `StartInterval` 300 + bucle en script: uso continuo de CPU/memoria. |
| 4 | `com.bittorrent.uTorrent.plist` | P2P: red y disco sostenidos si el cliente está activo. |
| 5 | `com.mercado.auto.plist` | `RunAtLoad` + cada 3600 s: `npm` + red; fallos repetidos siguen gastando CPU/red. |
| 6 | `com.epicgames.launcher.plist` | `RunAtLoad`: launcher en memoria al inicio de sesión. |
| 7 | `com.tsbgaming.thesandboxlauncher.plist` | `RunAtLoad`: launcher. |
| 8 | `com.openai.atlas.update-helper.plist` | Intervalo 3600 s; helper en segundo plano. |
| 9 | `mega.mac.megaupdater.plist` | Updater; si el binario falta, igual puede reintentar (ruido). |
| 10 | `com.valvesoftware.steamclean.plist` | `RunAtLoad`; tarea de limpieza Steam (varía). |
| 11 | `com.dropbox.DropboxUpdater.wake.plist` | Intervalo 3600 s; despertar/updater. |
| 12 | `com.adobe.GC.Invoker-1.0.plist` | Invocador GC Adobe (scheduler en label); carga esporádica. |
| 13 | `com.vmc.lacanplus.daily.plist` | 1× día; burst corto (Python + SMTP). |
| 14 | `com.bmc.drive-cleanup.plist` | Cada hora pero **no** `RunAtLoad`; si hay espacio, sale enseguida. |
| 15 | `com.dropbox.dropboxmacupdate.agent.plist` | **Vacío** — no programa trabajo. |
| 16 | `com.dropbox.dropboxmacupdate.xpcservice.plist` | **Vacío** — idem. |

### Metodología — risk score (orden 1–16)

**Riesgo** = fragilidad operativa + superficie de ejecución (scripts propios, `bash -c`, credenciales, `kill`, DB expuesta) + **no** “peso” de CPU. Plists vacíos: riesgo bajo pero inútiles.

### Ranking B — risk score (1 = más alto riesgo / más crítico auditar)

| Rank | Plist | Por qué |
|------|--------|---------|
| 1 | `com.user.autopilot.monitor.plist` | Script custom con `KeepAlive`; puede terminar procesos (`kill`, `fileproviderd` / Mail). |
| 2 | `com.mercado.auto.plist` | `bash -c` + venv + npm; rutas frágiles; errores en log. |
| 3 | `com.bittorrent.uTorrent.plist` | P2P: red y superficie; no es “malware” pero es **alto riesgo operativo**. |
| 4 | `com.vmc.lacanplus.daily.plist` | SMTP + `lacan_plus.yaml` (secretos); envío de correo. |
| 5 | `homebrew.mxcl.postgresql@14.plist` | DB local: datos y puertos si queda escuchando. |
| 6 | `homebrew.mxcl.mongodb-community.plist` | Idem. |
| 7 | `mega.mac.megaupdater.plist` | Binario externo; en auditoría hubo path **no encontrado**; revisar integridad. |
| 8 | `com.tsbgaming.thesandboxlauncher.plist` | Launcher de juego; autostart. |
| 9 | `com.epicgames.launcher.plist` | Idem. |
| 10 | `com.openai.atlas.update-helper.plist` | Vendor; updater periódico. |
| 11 | `com.valvesoftware.steamclean.plist` | Vendor; limpieza Steam. |
| 12 | `com.dropbox.DropboxUpdater.wake.plist` | Vendor; updater. |
| 13 | `com.adobe.GC.Invoker-1.0.plist` | Vendor; mismatch nombre archivo vs label. |
| 14 | `com.bmc.drive-cleanup.plist` | Script **en repo**; revisable; diálogo explícito. |
| 15 | `com.dropbox.dropboxmacupdate.agent.plist` | Vacío; sin ejecución. |
| 16 | `com.dropbox.dropboxmacupdate.xpcservice.plist` | Vacío; sin ejecución. |

### Tabla cruzada (resumen)

| Plist | Rank recursos | Rank riesgo |
|-------|----------------|-------------|
| `homebrew.mxcl.postgresql@14.plist` | 1 | 5 |
| `homebrew.mxcl.mongodb-community.plist` | 2 | 6 |
| `com.user.autopilot.monitor.plist` | 3 | 1 |
| `com.bittorrent.uTorrent.plist` | 4 | 3 |
| `com.mercado.auto.plist` | 5 | 2 |
| `com.epicgames.launcher.plist` | 6 | 9 |
| `com.tsbgaming.thesandboxlauncher.plist` | 7 | 8 |
| `com.openai.atlas.update-helper.plist` | 8 | 10 |
| `mega.mac.megaupdater.plist` | 9 | 7 |
| `com.valvesoftware.steamclean.plist` | 10 | 11 |
| `com.dropbox.DropboxUpdater.wake.plist` | 11 | 12 |
| `com.adobe.GC.Invoker-1.0.plist` | 12 | 13 |
| `com.vmc.lacanplus.daily.plist` | 13 | 4 |
| `com.bmc.drive-cleanup.plist` | 14 | 14 |
| `com.dropbox.dropboxmacupdate.agent.plist` | 15 | 15 |
| `com.dropbox.dropboxmacupdate.xpcservice.plist` | 16 | 16 |

---

## Scripts custom — revisión breve

### `com.bmc.drive-cleanup` → [`scripts/drive-cleanup-automated.sh`](../scripts/drive-cleanup-automated.sh)

- Umbral espacio, diálogo macOS, caches seguros; documentado en [DRIVE-CLEANUP-AUTOMATED.md](./DRIVE-CLEANUP-AUTOMATED.md).
- Instalación: [`scripts/install-drive-cleanup-hourly.sh`](../scripts/install-drive-cleanup-hourly.sh).

### `com.mercado.auto`

- Comando: activar venv en `chatbot-2311` y `npm run mercado-auto`.
- **Acción:** definir si el script `mercado-auto` sigue existiendo; si no, `launchctl unload` o eliminar el plist.

### `com.user.autopilot.monitor` → `~/.autopilot/autopilot_daemon.sh`

- Daemon con lockfile; monitorea CPU/memoria y puede matar procesos (`fileproviderd`, Mail). Alto impacto: mantener solo si aún querés ese comportamiento automático.

### `com.vmc.lacanplus.daily` → `~/LACAN_Plus/lacan_plus.py`

- Lee `lacan_plus.yaml` (SMTP, destinatarios). Revisar rotación de secretos y que el runner configurado siga siendo el deseado.

---

## MongoDB y PostgreSQL

- **Estado:** `brew services list` reportó `mongodb-community` y `postgresql@14` como **none** (no activos como servicio gestionado).
- **Puertos (2026-03-21):** `lsof -iTCP -sTCP:LISTEN` no mostró procesos `mongo` ni `postgres` en esta máquina.
- **Decisión:** no hace falta unload urgente si los servicios no están escuchando; si no querés que arranquen al login, podés `launchctl unload` de los dos plists Homebrew o eliminarlos y usar solo `brew services start` cuando necesites la DB.
- **Recomendación:** si no usás estos stacks en el día a día, podés dejar los plists pero **no cargarlos**, o `brew services stop` / quitar `launchctl load` si los habías cargado a mano. PostgreSQL en Homebrew suele usar `KeepAlive` true en el plist cuando está cargado; el peso es “servidor siempre arriba”.
- **Verificación local:** `lsof -iTCP -sTCP:LISTEN | grep -E 'postgres|mongo'` cuando necesites confirmar puertos.

---

## Dropbox vacíos

- Archivos: `com.dropbox.dropboxmacupdate.agent.plist`, `com.dropbox.dropboxmacupdate.xpcservice.plist`.
- **Contenido:** diccionario vacío; no definen job útil.
- **Decisión adoptada:** **recomendado borrar** ambos plists para reducir ruido; si Dropbox Desktop los vuelve a crear, evaluar si la app sigue actualizada. No hay `Label` ni `ProgramArguments`; no cargan trabajo útil.

---

## Regenerar el informe

```bash
cd /ruta/al/repo/Calculadora-BMC
./scripts/audit-launchagents-matias.sh | tee /tmp/launchagents-audit.md
./scripts/audit-launchagents-matias.sh --json | tee /tmp/launchagents-audit.json
```

**Opciones:** `SCAN_ALL=1` (default) escanea todos los `.plist` del directorio y marca **new** / **regenerated**.  
**Descripciones:** Ver [`scripts/launchagents-manifest.md`](../scripts/launchagents-manifest.md) — cuándo corre cada uno y para qué.
