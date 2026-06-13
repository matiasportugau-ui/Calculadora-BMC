# TraKtiMe — Tauri desktop spike (Fase 4)

> **Estado:** scaffold, **sin compilar en este entorno** (no hay toolchain Rust
> en la sesión web). Es la base para que el equipo lo compile/itere. Cierra el
> recorrido (`RECORRIDO-TIME-TRACKER.md`): el always-on-top nativo real +
> system tray + hotkey global que el navegador no puede dar.

## Qué hace

Un **wrapper de escritorio mínimo (Tauri v2)** que abre una ventana
**always-on-top** con la vista del mini-timer de TraKtiMe (la misma
`?tkDetached=1` que ya usa el widget Document-PiP), más:

- **System tray** con menú *Mostrar/Ocultar* y *Salir*.
- **Hotkey global** `Cmd/Ctrl+Shift+T` para mostrar/ocultar el timer.

Toda la UI vive en la web app; Tauri solo aporta el shell nativo (always-on-top,
tray, hotkey). Por eso el spike es chico: ~1 archivo Rust de lógica.

## Por qué Tauri (no Electron)

Del recorrido: Tauri v2 ≈ 10 MB y bajo consumo, con `alwaysOnTop` nativo, tray
y global-shortcut de primera; Electron pesa ~150 MB. Para un timer "siempre
visible" que corre todo el día, el footprint importa.

## Estructura (`src-tauri/`)

| Archivo | Rol |
|---|---|
| `tauri.conf.json` | Ventana `timer` (always-on-top, 360×260), `identifier`, bundle. Por defecto carga la **app de producción** `…/hub/traktime?tkDetached=1` (shell remoto, cero bundling). |
| `Cargo.toml` | Deps: `tauri` (feature `tray-icon`) + `tauri-plugin-global-shortcut`. |
| `src/main.rs` / `src/lib.rs` | Entry + builder: tray menu, hotkey global, toggle de la ventana. |
| `build.rs` | `tauri_build::build()`. |
| `capabilities/default.json` | Permisos v2 mínimos (window show/hide/focus/always-on-top + global-shortcut). |
| `icons/` | Generados, no commiteados (ver `icons/README.md`). |

## Cómo correrlo (requiere toolchain local)

Prerrequisitos: **Rust** (`rustup`) + dependencias de sistema de Tauri
(WebKitGTK en Linux, Xcode CLT en macOS, WebView2 en Windows). Ver
https://tauri.app/start/prerequisites/.

```bash
# 1. Generar iconos una vez (desde un PNG cuadrado ≥1024px)
npm run tauri:icon path/to/bmc-logo-1024.png

# 2. Dev (abre la ventana de escritorio; por defecto apunta a prod)
npm run tauri:dev

# 3. Build de instaladores (.dmg/.msi/.AppImage según OS)
npm run tauri:build
```

Los scripts usan `npx @tauri-apps/cli@^2` → **no agregan dependencias** al
`package.json` ni tocan el lockfile (no afectan el build web ni la CI).

## Dos modos de carga

- **Remoto (default):** `tauri.conf.json → app.windows[0].url` apunta a
  `https://calculadora-bmc.vercel.app/hub/traktime?tkDetached=1`. Shell delgado
  sobre la SPA en vivo; el login persiste en el webview (cookie). Cero bundling.
- **Bundleado (local):** cambiar `url` a `index.html` y usar `frontendDist:
  "../dist"` + `beforeBuildCommand: "npm run build"` para empaquetar la SPA. Ojo
  con el SPA-fallback de rutas path-based (BrowserRouter) en el protocolo
  `tauri://`.

## Pendiente / próximos pasos

- Compilar y probar en cada OS (no hecho acá).
- Decidir modo remoto vs bundleado.
- (Opcional, Fase 3) embeber un watcher de actividad nativo en el binario, en
  vez de depender del daemon ActivityWatch separado.
- Persistir posición/tamaño de la ventana entre sesiones.
