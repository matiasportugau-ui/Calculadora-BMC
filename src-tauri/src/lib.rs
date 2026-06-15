// BMC TraKtiMe — desktop wrapper (Fase 4 spike).
//
// Thin always-on-top window around the existing TraKtiMe detached timer
// (the same `?tkDetached=1` SPA view used by the Document-PiP widget), plus:
//   - a system-tray icon with a Show/Hide + Quit menu, and
//   - a global shortcut (Cmd/Ctrl+Shift+T) to toggle the timer window.
//
// Everything UI lives in the web app; this only provides the native shell that
// the browser can't: real always-on-top, tray, and a global hotkey.

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, Runtime,
};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

/// Show the timer window if hidden, hide it if visible.
fn toggle_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window("timer") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Cmd+Shift+T (macOS) / Ctrl+Shift+T (Windows/Linux). The primary modifier
    // differs per OS: SUPER is Cmd on macOS but the Windows/Super key elsewhere,
    // so use CONTROL off-macOS to match the documented Ctrl+Shift+T.
    // Exactly one shortcut is registered, so the handler can toggle on any
    // Pressed event without re-comparing it (avoids moving `toggle` into both
    // the registration and the closure).
    let primary = if cfg!(target_os = "macos") {
        Modifiers::SUPER
    } else {
        Modifiers::CONTROL
    };
    let toggle = Shortcut::new(Some(primary | Modifiers::SHIFT), Code::KeyT);

    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut(toggle)
                .expect("failed to register global shortcut")
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        toggle_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Mostrar / Ocultar", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let mut tray = TrayIconBuilder::new()
                .tooltip("BMC TraKtiMe")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => toggle_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                });
            // Use the bundled window icon if it's available (run `tauri icon`
            // first to generate src-tauri/icons/*).
            if let Some(icon) = app.default_window_icon().cloned() {
                tray = tray.icon(icon);
            }
            tray.build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running BMC TraKtiMe");
}
