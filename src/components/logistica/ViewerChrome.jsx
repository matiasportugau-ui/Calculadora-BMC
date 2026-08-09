/**
 * Resizable + fullscreen wrapper for the 3D logistics viewer.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const HEIGHT_KEY = "bmc-logistica-viewer-height";
const MIN_H = 240;
const MAX_H = 900;
const DEFAULT_H = 360;

function readStoredHeight() {
  try {
    const n = Number(localStorage.getItem(HEIGHT_KEY));
    if (Number.isFinite(n) && n >= MIN_H && n <= MAX_H) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_H;
}

/**
 * @param {{
 *   children: import('react').ReactNode,
 *   heightPx?: number,
 *   onHeightChange?: (h: number) => void,
 *   toolbar?: import('react').ReactNode,
 *   className?: string,
 *   style?: object,
 * }} props
 */
export default function ViewerChrome({
  children,
  heightPx: heightControlled,
  onHeightChange,
  toolbar = null,
  className = "",
  style = {},
}) {
  const rootRef = useRef(null);
  const [height, setHeight] = useState(() => heightControlled ?? readStoredHeight());
  const [fs, setFs] = useState(false);
  const [pseudoFs, setPseudoFs] = useState(false);

  useEffect(() => {
    if (heightControlled != null && Number.isFinite(heightControlled)) {
      setHeight(heightControlled);
    }
  }, [heightControlled]);

  const commitHeight = useCallback(
    (h) => {
      const next = Math.min(MAX_H, Math.max(MIN_H, Math.round(h)));
      setHeight(next);
      onHeightChange?.(next);
      try {
        localStorage.setItem(HEIGHT_KEY, String(next));
      } catch {
        /* ignore */
      }
    },
    [onHeightChange],
  );

  const onResizePointerDown = (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    const move = (ev) => {
      commitHeight(startH + (ev.clientY - startY));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const enterFullscreen = async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        setFs(true);
        return;
      }
    } catch {
      /* fall through */
    }
    setPseudoFs(true);
    setFs(true);
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
    setPseudoFs(false);
    setFs(false);
  };

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setFs(false);
        setPseudoFs(false);
      } else if (document.fullscreenElement === rootRef.current) {
        setFs(true);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const displayH = fs ? "100%" : height;
  const shellStyle = pseudoFs
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#0b1628",
        display: "flex",
        flexDirection: "column",
        ...style,
      }
    : {
        position: "relative",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 8,
        overflow: "hidden",
        background: "#0b1628",
        ...style,
      };

  return (
    <div ref={rootRef} className={className} style={shellStyle} data-viewer-chrome data-fullscreen={fs ? "1" : "0"}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px",
          background: "rgba(0,0,0,.35)",
          borderBottom: "1px solid rgba(255,255,255,.08)",
          flexShrink: 0,
        }}
      >
        {toolbar}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {!fs ? (
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.7)", fontSize: 11 }}>
              Altura
              <input
                type="range"
                min={MIN_H}
                max={MAX_H}
                value={height}
                onChange={(e) => commitHeight(Number(e.target.value))}
                style={{ width: 100 }}
              />
              <span style={{ minWidth: 36 }}>{height}px</span>
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => (fs ? exitFullscreen() : enterFullscreen())}
            style={chromeBtn}
            title={fs ? "Salir de pantalla completa" : "Pantalla completa (armado inmersivo)"}
          >
            {fs ? "✕ Salir FS" : "⛶ Fullscreen"}
          </button>
        </div>
      </div>
      <div style={{ flex: fs ? 1 : undefined, height: displayH, minHeight: fs ? 0 : height, position: "relative" }}>
        {children}
      </div>
      {!fs ? (
        <div
          role="separator"
          aria-orientation="horizontal"
          onPointerDown={onResizePointerDown}
          title="Arrastrá para redimensionar el visor"
          style={{
            height: 10,
            cursor: "ns-resize",
            background: "linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.12))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ width: 40, height: 3, borderRadius: 2, background: "rgba(255,255,255,.35)" }} />
        </div>
      ) : null}
    </div>
  );
}

const chromeBtn = {
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,.28)",
  background: "rgba(255,255,255,.1)",
  color: "#fff",
  cursor: "pointer",
};

export { MIN_H as VIEWER_MIN_H, MAX_H as VIEWER_MAX_H, DEFAULT_H as VIEWER_DEFAULT_H };
