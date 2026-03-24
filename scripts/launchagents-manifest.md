# LaunchAgents manifest — cuándo y para qué

**Fuente:** [docs/plans/auditoria-launchagents-macos.md](../docs/plans/auditoria-launchagents-macos.md) (plan original: `~/.cursor/plans/auditoría_launchagents_macos_104d5796.plan.md`). Este archivo documenta cada plist conocido para que el script de auditoría muestre descripciones y detecte **nuevos** o **regenerados** (que archivamos y volvieron).

| Label / plist | Cuándo corre | Para qué | Tipo |
|---------------|-------------|----------|------|
| `com.adobe.GC.Invoker-1.0` | Según Adobe | Invocador Adobe Creative Cloud | vendor |
| `com.bittorrent.uTorrent` | Al login / intervalo | Cliente uTorrent — descargas P2P | vendor |
| `com.bmc.drive-cleanup` | Cada hora (min 0) si espacio < THRESHOLD_GB | Limpieza caches (Atlas, Google, pip, etc.) → Papelera. Repo: `scripts/install-drive-cleanup-hourly.sh` | custom |
| `com.bmc.host-audit` | Cada hora (min 0) | Disco (GB libres) + LaunchAgents (audit completo). Reportes: `~/.cache/bmc-audit-host/latest.md`. Repo: `scripts/install-host-audit-hourly.sh` | custom |
| `com.dropbox.dropboxmacupdate.agent` | Según Dropbox | Updater agent (a menudo vacío `<dict/>`) | vendor |
| `com.dropbox.dropboxmacupdate.xpcservice` | Según Dropbox | XPC service update (a menudo vacío) | vendor |
| `com.dropbox.DropboxUpdater.wake` | Wake / intervalo | Despertar updater Dropbox | vendor |
| `com.epicgames.launcher` | Al login / intervalo | Epic Games Launcher | vendor |
| `com.mercado.auto` | RunAtLoad + cada 3600 s | `npm run mercado-auto` (venv + proyecto Mercado); paths fijos — frágil si se mueve el repo | custom |
| `com.openai.atlas.update-helper` | Según OpenAI | Actualizador helper Atlas | vendor |
| `com.tsbgaming.thesandboxlauncher` | Según The Sandbox | Launcher The Sandbox | vendor |
| `com.user.autopilot.monitor` | RunAtLoad + KeepAlive + cada 300 s | Daemon `~/.autopilot/autopilot_daemon.sh` — persistencia alta | custom |
| `com.valvesoftware.steamclean` | Según Steam | Limpieza Steam | vendor |
| `com.vmc.lacanplus.daily` | 09:00 + RunAtLoad | `lacan_plus.py` — tarea diaria Python (SMTP, etc.) | custom |
| `homebrew.mxcl.mongodb-community` | RunAtLoad | Servidor MongoDB (Homebrew) | vendor |
| `homebrew.mxcl.postgresql@14` | RunAtLoad + KeepAlive | Servidor PostgreSQL 14 (Homebrew) — siempre arriba | vendor |
| `mega.mac.megaupdater` | Intervalo | Actualizador MEGA | vendor |

## Archivo archivados (LaunchAgents-disabled)

Los plists movidos con `mac-launchagents-unload-blocklist.sh ARCHIVE=1` van a `~/Library/LaunchAgents-disabled/`.  
Si un plist **estaba archivado** y **vuelve a aparecer** en `~/Library/LaunchAgents/`, la app lo regeneró — el audit lo marca como **regenerado**.

## Plists nuevos

Cualquier `.plist` en `~/Library/LaunchAgents/` que **no esté** en este manifest ni en la lista conocida del script se reporta como **nuevo** (revisar origen y necesidad).
