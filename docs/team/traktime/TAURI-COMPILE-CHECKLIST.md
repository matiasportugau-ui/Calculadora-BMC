# TraKtiMe Desktop (Tauri) — Checklist de compilación

Para quien vaya a **compilar y probar** el binario de escritorio por primera vez.
El scaffold (Fase 4) entró sin compilar; este doc es la guía paso a paso.

- **Stack:** Tauri **v2**, Rust edition 2021 (**rust-version ≥ 1.77.2**), plugin
  `tauri-plugin-global-shortcut`, feature `tray-icon`.
- **Modo de carga (decidido 15/06):** **remoto/prod** — la ventana abre
  `https://calculadora-bmc.vercel.app/hub/traktime?tkDetached=1`. No se bundlea
  la SPA; el binario es un shell nativo always-on-top sobre el sitio en vivo.
- **Fuente:** `src-tauri/` (`Cargo.toml`, `tauri.conf.json`, `src/lib.rs`, `src/main.rs`).

---

## 0. Prerrequisitos del sistema

### Todos los OS
- **Rust** (incluye `cargo`): https://rustup.rs → `rustup default stable`
  (verificar `rustc --version` ≥ 1.77.2).
- **Node 24.x** + repo ya clonado con `npm install` corrido en la raíz
  (los scripts `tauri:*` viven en el `package.json` raíz).

### macOS
- **Xcode Command Line Tools:** `xcode-select --install`.
- (Opcional, para distribuir) cuenta Apple Developer para firmar/notarizar.

### Windows
- **Microsoft C++ Build Tools** (MSVC) + **WebView2 Runtime**
  (preinstalado en Win10/11 recientes).

### Linux (Debian/Ubuntu)
```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev build-essential curl wget file libssl-dev
```
> `libayatana-appindicator3-dev` es necesario por el **tray icon**.

---

## 1. Generar los iconos (obligatorio antes de `build`)

`src-tauri/icons/` hoy solo tiene un README — `tauri.conf.json` referencia
`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico` que **aún
no existen**. Generarlos desde un PNG cuadrado (≥ 1024×1024, idealmente el
isotipo BMC):

```bash
npm run tauri:icon ruta/al/logo-bmc.png
```
Esto puebla `src-tauri/icons/` con todos los tamaños (incl. `.icns` y `.ico`).
`tauri dev` puede arrancar sin esto, pero `tauri build` falla sin los iconos.

---

## 2. Correr en desarrollo

```bash
npm run tauri:dev
```
- Compila el crate Rust (la primera vez baja y compila dependencias — varios
  minutos) y abre la ventana **TraKtiMe** (360×260, always-on-top, centrada).
- **Caveat dev:** `beforeDevCommand` levanta Vite en :5173, pero la ventana
  **igual carga la URL de prod** (modo remoto). Para iterar contra cambios
  locales, cambiar temporalmente `app.windows[0].url` en `tauri.conf.json` a
  `http://localhost:5173/hub/traktime?tkDetached=1`.

---

## 3. Build de producción (instalable)

```bash
npm run tauri:build
```
Artefactos en `src-tauri/target/release/bundle/`:
- **macOS:** `.app` + `.dmg` (firmar/notarizar aparte si se distribuye).
- **Windows:** `.msi` / `.exe` (NSIS).
- **Linux:** `.deb` / `.AppImage`.

> Sin firma de código, macOS/Windows mostrarán warning de "app no
> verificada" al instalar. Para uso interno alcanza; para distribuir, configurar
> signing en `tauri.conf.json > bundle`.

---

## 4. Qué verificar (smoke manual)

- [ ] La ventana abre always-on-top y **flota sobre otras apps** (Cmd/Tab a otra app → sigue visible).
- [ ] El timer de TraKtiMe carga (login si hace falta) y **start/stop funciona**.
- [ ] **Tray icon** presente con menú **"Mostrar / Ocultar"** y **"Salir"**.
- [ ] **Hotkey global Cmd+Shift+T** (macOS) / **Ctrl+Shift+T** (Win/Linux) muestra/oculta la ventana, incluso con la app en background.
- [ ] Cerrar desde el tray ("Salir") termina el proceso limpio.

---

## 5. Notas / caveats conocidos

- **`lib.rs` ya endurecido** (PR de hardening): el handler del hotkey togglea en
  cualquier `Pressed` sin re-comparar el `Shortcut` (evitaba un posible
  `E0382 use of moved value`). No debería haber sorpresas de compilación ahí.
- **Sin persistencia de posición/tamaño** de la ventana entre sesiones (mejora futura).
- **Sin watcher de actividad nativo** — ActivityWatch sigue siendo un daemon
  separado y opt-in (ver `ACTIVITYWATCH-OPTIN.md`); no se embebe en el binario.
- Si `tauri build` se queja de target faltante en Linux, instalar el target o
  acotar `bundle.targets` (ej. `"targets": ["appimage"]`).

---

_Companion: `TAURI-DESKTOP-SPIKE.md` (diseño del spike)._
