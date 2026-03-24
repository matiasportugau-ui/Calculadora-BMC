# Drive Cleanup — Automated Hourly Run

Limpieza automática de caches seguros cada hora. Solo toca caches regenerables; **no afecta** el proyecto Calculadora-BMC ni datos de usuario.

## Flujo de aprobación

Cuando el espacio libre cae bajo el umbral:

1. **Genera reporte** → guarda en `~/.cache/drive-cleanup/pending-report-*.txt`
2. **Muestra diálogo** → "Drive Cleanup" con resumen y botones Aprobar / Cancelar
3. **Si Aprobar** → mueve los caches a la **Papelera** (por defecto)
4. **Si Cancelar o timeout (2 min)** → no hace nada, solo registra en log

Por defecto los archivos van a la Papelera (`~/.Trash/DriveCleanup-YYYYMMDD-HHMMSS/`). Podés revisarlos y vaciar la Papelera cuando quieras para liberar el espacio definitivamente.

Requiere que estés en la sesión gráfica (el diálogo es de macOS). Si no estás presente, tras 2 minutos se cancela automáticamente.

## Qué limpia (seguro)

| Cache | Regenerable |
|-------|-------------|
| com.openai.atlas | ✓ |
| Google (Chrome/etc) | ✓ |
| SiriTTS | ✓ |
| node-gyp | ✓ |
| Homebrew | ✓ |
| Playwright | ✓ |
| pip | ✓ |
| npm cache | ✓ |
| pnpm store | ✓ |

## Configuración

### 1. Hacer ejecutable el script

```bash
chmod +x scripts/drive-cleanup-automated.sh
```

### 2. Probar en modo dry-run (no borra nada)

```bash
DRY_RUN=1 ./scripts/drive-cleanup-automated.sh
```

### 3. Ejecutar una vez manualmente

```bash
./scripts/drive-cleanup-automated.sh
```

Los logs se guardan en `~/.cache/drive-cleanup/cleanup-YYYYMMDD.log`.

### 4. Activar ejecución cada hora (launchd)

**Opción A — Instalador (recomendado):** genera el plist con la ruta correcta del repo.

```bash
./scripts/install-drive-cleanup-hourly.sh
```

**Opción B — Manual:** copiar el plist y editar la ruta del script si hace falta.

```bash
mkdir -p ~/.cache/drive-cleanup
cp scripts/drive-cleanup-launchd.plist ~/Library/LaunchAgents/com.bmc.drive-cleanup.plist
# Editar ~/Library/LaunchAgents/com.bmc.drive-cleanup.plist y cambiar la ruta del script
launchctl load ~/Library/LaunchAgents/com.bmc.drive-cleanup.plist
```

### 5. Verificar que está cargado

```bash
launchctl list | grep drive-cleanup
```

### 6. Detener la automatización

```bash
launchctl unload ~/Library/LaunchAgents/com.bmc.drive-cleanup.plist
```

## Variables de entorno

| Variable | Default | Descripción |
|---------|---------|-------------|
| `THRESHOLD_GB` | 5 | Solo mostrar diálogo si espacio libre &lt; X GB. `0` = siempre. |
| `DIALOG_TIMEOUT` | 120 | Segundos para esperar aprobación. `0` = sin timeout. |
| `SKIP_APPROVAL` | 0 | `1` = ejecutar sin pedir aprobación (útil para manual). |
| `DRY_RUN` | 0 | `1` = solo reporte, no diálogo ni limpieza. |
| `USE_TRASH` | 1 | `1` = mover a Papelera (revisar y vaciar manual). `0` = borrar permanentemente. |
| `LOG_DIR` | `~/.cache/drive-cleanup` | Carpeta de logs y reportes. |

Para cambiar `THRESHOLD_GB` en el plist, editar la sección `EnvironmentVariables` y volver a cargar:

```bash
launchctl unload ~/Library/LaunchAgents/com.bmc.drive-cleanup.plist
launchctl load ~/Library/LaunchAgents/com.bmc.drive-cleanup.plist
```

## Horario

Por defecto el plist usa `StartCalendarInterval` con `Minute: 0`, es decir **cada hora en el minuto 0** (1:00, 2:00, 3:00, …).

Para ejecutar cada 30 minutos, añadir un segundo intervalo:

```xml
<key>StartCalendarInterval</key>
<array>
  <dict><key>Minute</key><integer>0</integer></dict>
  <dict><key>Minute</key><integer>30</integer></dict>
</array>
```

## Logs

- **Diario:** `~/.cache/drive-cleanup/cleanup-YYYYMMDD.log`
- **launchd stdout:** `~/.cache/drive-cleanup/launchd-out.log`
- **launchd stderr:** `~/.cache/drive-cleanup/launchd-err.log`

## Seguridad

- No borra información de usuario.
- No toca `node_modules`, `.env`, `dist/`, ni archivos del proyecto.
- Solo caches regenerables (las apps los recrean al usarlas).
- Basado en [.cursor/skills/drive-space-optimizer/SKILL.md](../.cursor/skills/drive-space-optimizer/SKILL.md).

## Si movés el repo en el disco

`~/Library/LaunchAgents/com.bmc.drive-cleanup.plist` guarda la **ruta absoluta** al script. Si renombrás o movés la carpeta **Calculadora-BMC**, volvé a ejecutar desde la nueva raíz:

```bash
./scripts/install-drive-cleanup-hourly.sh
```

## Espacio en disco y LaunchAgents

El **paso 10** de `run_audit.sh` verifica **espacio en disco** (GB libres en `/`) y **LaunchAgents** (audit completo con nuevo/regenerado). Un solo reporte para higiene del host.

**Job cada hora (ligero):** Para revisar disco + LaunchAgents sin ejecutar el audit completo:

```bash
./scripts/install-host-audit-hourly.sh
```

Escribe en `~/.cache/bmc-audit-host/latest.md`. Ver [launchagents-manifest.md](../scripts/launchagents-manifest.md) (`com.bmc.host-audit`).

## Auditoría de LaunchAgents (incluye este job)

Esto es **higiene del sistema**, no parte del stack de la aplicación. Ver [HOST-MAC-NOT-PRODUCT.md](./HOST-MAC-NOT-PRODUCT.md).

Para revisar `com.bmc.drive-cleanup` junto con otros agentes (plutil, rutas, score de persistencia, JSON):

```bash
./scripts/audit-launchagents-matias.sh
./scripts/audit-launchagents-matias.sh --json
```

Informe detallado de hallazgos (scripts custom, DB, Dropbox vacíos, fix XML Mercado): [LAUNCHAGENTS-AUDIT-REPORT.md](./LAUNCHAGENTS-AUDIT-REPORT.md).
