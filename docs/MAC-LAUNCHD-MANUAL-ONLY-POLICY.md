# macOS: evitar que cosas corran solas (LaunchAgents)

**Alcance:** tu Mac; **no** es documentación del producto BMC. Ver [HOST-MAC-NOT-PRODUCT.md](./HOST-MAC-NOT-PRODUCT.md).

---

## Lo que macOS **no** hace

- **No** hay un permiso tipo “¿Permitir que este job de launchd se ejecute?” por cada disparo (como en iOS). Si un `plist` está en `~/Library/LaunchAgents/` y está **cargado** en `launchctl`, launchd lo ejecuta según las claves (`RunAtLoad`, `StartInterval`, `StartCalendarInterval`, `KeepAlive`, etc.).
- **Sí** controlás **qué** archivos existen y **qué** está cargado en tu sesión de usuario.

Conclusión: “solo con mi permiso” = **no cargar** jobs que no querés, o **no tener** el plist (o tenerlo fuera de la carpeta que launchd lee).

---

## Política recomendada: lista blanca

1. **Persistencia solo si la elegís vos**  
   - Tratá como “permitidos” solo: **Apple / sistema** (no suelen vivir en tu `~/Library/LaunchAgents` salvo migraciones) y **apps que usás a diario** y confiás en su vendor.  
   - Todo lo demás (scripts viejos, chatbots, autopilot, mercado, DB local si no desarrollás): **unload** o **sacá el plist** de `LaunchAgents`.

2. **Nada de `KeepAlive` + script propio** salvo que lo hayas leído y lo quieras 24/7. Eso es lo más cercano a “persistencia no recomendada” para tareas personales.

3. **Homebrew `mongodb` / `postgresql`:** si no son imprescindibles, no los cargues al login; arrancalos con `brew services run …` cuando trabajes.

---

## Cómo implementarlo (pasos concretos)

### A) Ver qué está cargado (tu usuario)

```bash
launchctl list | head -20
launchctl list | grep -E 'bmc|mercado|autopilot|mongo|postgres|uTorrent|epic|mega|atlas'
```

### B) Descargar un job sin borrar el plist (reversible)

Sustituí `com.example.label` por el **Label** del plist (no siempre coincide con el nombre del archivo).

```bash
LABEL="com.example.label"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$HOME/Library/LaunchAgents/${LABEL}.plist" 2>/dev/null
```

En macOS recientes, `bootout gui/$(id -u)/label` es el camino preferido cuando el servicio está registrado con ese dominio.

### C) Evitar que vuelva a cargarse al login

- **Opción 1 — Archivar el plist:** mové el archivo fuera de `~/Library/LaunchAgents/` (por ejemplo `~/Library/LaunchAgents-disabled/nombre.plist`). launchd **no** carga plists que no estén en esa carpeta.
- **Opción 2 — Borrar** el plist si estás seguro.
- **Opción 3 — App que lo recrea:** desinstalá la app o desactivá su “abrir al inicio” en **Ajustes del sistema → General → Elementos de inicio** (según versión de macOS el nombre varía).

### D) Tareas que querés solo “cuando yo ejecuto”

- No uses `plist` con `RunAtLoad` ni intervalos. Ejecutá el script a mano o con un **atajo** (Shortcuts) / alias en la terminal.
- Ejemplo drive cleanup: podés **unload** `com.bmc.drive-cleanup` y correr cuando quieras:

```bash
# Desde la raíz del repo
THRESHOLD_GB=8 ./scripts/drive-cleanup-automated.sh
```

Si más adelás querés otra vez cada hora, volvés a instalar con `./scripts/install-drive-cleanup-hourly.sh` (eso **sí** vuelve a programar; es una decisión explícita).

---

## Qué cuenta como “solo sistema”

- Daemons y agents de **Apple** bajo `/System/Library/LaunchDaemons`, `/System/Library/LaunchAgents` (y similares): los gestiona el sistema; no los toques salvo documentación oficial.
- Cosas en **`/Library/LaunchDaemons`** (no tu home): suelen ser de terceros con privilegios; requieren sudo y cuidado.
- Tu carpeta **`~/Library/LaunchAgents`**: ahí **vos** decidís qué queda; es el lugar correcto para aplicar la lista blanca.

---

## Resumen

| Objetivo | Acción |
|----------|--------|
| Nada automático sin tu acuerdo | No dejar plists cargados que no hayas elegido; archivar o borrar el resto. |
| Sin persistencia “rara” | Evitar `KeepAlive` + scripts custom; unload DB/juegos/mercado/autopilot si no los usás. |
| Tarea solo cuando querés | Sin `plist` recurrente; script manual o atajo. |

Para inventario y rankings de los 16 plists que ya auditaste: [LAUNCHAGENTS-AUDIT-REPORT.md](./LAUNCHAGENTS-AUDIT-REPORT.md).

### E) Script: descargar varios jobs desde una lista

En el repo (solo Mac, no producto):

1. Copiá el ejemplo: [`scripts/mac-launchagents-blocklist.example.txt`](../scripts/mac-launchagents-blocklist.example.txt) → por ejemplo `~/mac-launchagents-blocklist.txt`.
2. Descomentá (quitá el `#` al inicio) las líneas de los `.plist` que querés **dejar de cargar**.
3. Simulación:  
   `DRY_RUN=1 ./scripts/mac-launchagents-unload-blocklist.sh ~/mac-launchagents-blocklist.txt`
4. Para aplicar y además **mover** el plist fuera de `LaunchAgents` (no vuelve al login):  
   `ARCHIVE=1 ./scripts/mac-launchagents-unload-blocklist.sh ~/mac-launchagents-blocklist.txt`

Los plists archivados quedan en `~/Library/LaunchAgents-disabled/` por defecto (`ARCHIVE_DIR` para cambiar). Revisá el output: si una app vuelve a instalar el plist, hay que desactivar su login item o desinstalar.
