# App icons (generated, not committed)

`tauri.conf.json` references `icons/32x32.png`, `icons/128x128.png`,
`icons/128x128@2x.png`, `icons/icon.icns`, `icons/icon.ico`. These are **not
committed** (binary, generated). Generate them once from a square source image
(≥1024×1024 PNG) before `tauri dev`/`tauri build`:

```bash
npm run tauri:icon path/to/bmc-logo-1024.png
```

That populates `src-tauri/icons/`. Until then, the tray falls back gracefully
(`default_window_icon()` may be `None`), but a release build needs them.
