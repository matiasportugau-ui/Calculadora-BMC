import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SKINS } from "./skins.js";
import { useSkin } from "./useSkin.js";
import Tooltip from "../help/Tooltip.jsx";
import FirstTimeTip from "../help/FirstTimeTip.jsx";
import { HELP_ANCHORS } from "../help/anchors.js";

export default function Topbar({ liveState = "ok", onOpenPalette, onChangeToken, onOpenLegacy }) {
  const { skin, setSkin } = useSkin();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  return (
    <header className="adminCot__topbar" role="banner">
      <nav className="adminCot__crumb" aria-label="Breadcrumb">
        <span>BMC</span>
        <span className="adminCot__crumb-sep">›</span>
        <Link to="/hub">hub</Link>
        <span className="adminCot__crumb-sep">›</span>
        <span style={{ color: "var(--ac-text)" }}>cotizaciones</span>
      </nav>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <Tooltip id={HELP_ANCHORS.TOPBAR_LIVE}>
          <span
            className="adminCot__live"
            data-tutorial-id="topbar-live"
            aria-live="polite"
            aria-label={
              liveState === "busy" ? "Procesando" :
              liveState === "error" ? "Error" : "Conectado"
            }
          >
            <span className="adminCot__live-dot" data-state={liveState} />
            {liveState === "busy" ? "Procesando…" : liveState === "error" ? "Error" : "En vivo"}
          </span>
        </Tooltip>

        <Tooltip id={HELP_ANCHORS.TOPBAR_CMDK}>
          <button
            type="button"
            className="adminCot__kbd"
            data-tutorial-id="topbar-cmdk"
            onClick={onOpenPalette}
            title="Paleta de comandos (Cmd/Ctrl + K)"
          >
            ⌘K
          </button>
        </Tooltip>

        <div className="adminCot__menu" ref={menuRef}>
          <button
            type="button"
            className="adminCot__btn adminCot__btn--ghost adminCot__btn--sm"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            title="Más opciones"
          >
            …
          </button>
          {menuOpen && (
            <div className="adminCot__menu-list" role="menu" style={{ position: "relative" }}>
              <FirstTimeTip id={HELP_ANCHORS.TOPBAR_SKIN_PICKER} placement="bottom" />
              <div className="adminCot__menu-section">Skin</div>
              {SKINS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={skin === s.id}
                  data-active={skin === s.id}
                  className="adminCot__menu-item"
                  onClick={() => { setSkin(s.id); setMenuOpen(false); }}
                >
                  {skin === s.id ? "● " : "○ "}{s.label}
                </button>
              ))}
              <div className="adminCot__menu-section">Sesión</div>
              <button
                type="button"
                role="menuitem"
                className="adminCot__menu-item"
                onClick={() => { setMenuOpen(false); onChangeToken?.(); }}
              >
                Cambiar token
              </button>
              <button
                type="button"
                role="menuitem"
                className="adminCot__menu-item"
                onClick={() => { setMenuOpen(false); onOpenLegacy?.(); }}
              >
                Ir al módulo viejo (/hub/admin?legacy=1)
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
