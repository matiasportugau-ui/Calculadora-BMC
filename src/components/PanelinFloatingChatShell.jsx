/**
 * In-page draggable/resizable host for Panelin chat (floating presentation).
 */
import { useCallback, useEffect, useRef } from "react";

const STYLE_ID = "panelin-float-shell-keyframes";
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function ensureKeyframes() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes panelin-float-in {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(s);
}

/**
 * @param {{
 *   rect: { x: number, y: number, width: number, height: number },
 *   onRectChange: (rect: { x: number, y: number, width: number, height: number }) => void,
 *   shellRef?: import('react').RefObject<HTMLDivElement|null>,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function PanelinFloatingChatShell({
  rect,
  onRectChange,
  shellRef: shellRefProp,
  children,
}) {
  const shellRefLocal = useRef(null);
  const shellRef = shellRefProp || shellRefLocal;
  const rectRef = useRef(rect);

  useEffect(() => {
    ensureKeyframes();
  }, []);

  useEffect(() => {
    rectRef.current = rect;
  }, [rect]);

  const persistRect = useCallback((next) => {
    rectRef.current = next;
    onRectChange(next);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("panelin-chat-float-rect", JSON.stringify(next));
      } catch {
        /* quota / private mode */
      }
    }
  }, [onRectChange]);

  const startResize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = { ...rectRef.current };
    const onMove = (ev) => {
      const nw = clamp(
        origin.width + ev.clientX - startX,
        300,
        window.innerWidth - rectRef.current.x - 8,
      );
      const nh = clamp(
        origin.height + ev.clientY - startY,
        320,
        window.innerHeight - rectRef.current.y - 8,
      );
      const next = { ...rectRef.current, width: nw, height: nh };
      rectRef.current = next;
      const el = shellRef.current;
      if (el) {
        el.style.width = `${nw}px`;
        el.style.height = `${nh}px`;
      }
    };
    const onUp = () => {
      persistRect(rectRef.current);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    document.body.style.cursor = "nwse-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, [persistRect, shellRef]);

  return (
    <div
      ref={shellRef}
      role="complementary"
      aria-label="Panelin Asistente BMC flotante"
      style={{
        position: "fixed",
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        zIndex: 350,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 14px 44px rgba(15,23,42,0.22)",
        border: "1px solid rgba(15,23,42,0.1)",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
        animation: "panelin-float-in 220ms cubic-bezier(0.4,0,0.2,1)",
        pointerEvents: "auto",
      }}
    >
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </div>
      <div
        role="separator"
        aria-label="Redimensionar ventana flotante"
        onPointerDown={startResize}
        title="Redimensionar"
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: 18,
          height: 18,
          cursor: "nwse-resize",
          touchAction: "none",
          background:
            "linear-gradient(135deg, transparent 50%, rgba(0,113,227,0.35) 50%)",
        }}
      />
    </div>
  );
}

export function createFloatingDragHandler({ rectRef, shellRef, onRectChange }) {
  const persistRect = (next) => {
    rectRef.current = next;
    onRectChange(next);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("panelin-chat-float-rect", JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
  };
  return (e) => {
    if (e.button !== 0) return;
    const blocked = e.target.closest?.(
      "button, input, textarea, select, a, [data-no-drag], [contenteditable='true']",
    );
    if (blocked) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = { ...rectRef.current };
    const onMove = (ev) => {
      const nx = clamp(origin.x + ev.clientX - startX, 0, window.innerWidth - rectRef.current.width);
      const ny = clamp(origin.y + ev.clientY - startY, 0, window.innerHeight - 48);
      const next = { ...rectRef.current, x: nx, y: ny };
      rectRef.current = next;
      const el = shellRef.current;
      if (el) {
        el.style.left = `${nx}px`;
        el.style.top = `${ny}px`;
      }
    };
    const onUp = () => {
      persistRect(rectRef.current);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
}

export function readDefaultFloatingRect() {
  if (typeof window === "undefined") {
    return { x: 0, y: 72, width: 380, height: 560 };
  }
  try {
    const raw = sessionStorage.getItem("panelin-chat-float-rect");
    const parsed = raw ? JSON.parse(raw) : null;
    if (
      parsed
      && Number.isFinite(parsed.x)
      && Number.isFinite(parsed.y)
      && Number.isFinite(parsed.width)
      && Number.isFinite(parsed.height)
    ) {
      return {
        x: parsed.x,
        y: parsed.y,
        width: clamp(parsed.width, 300, window.innerWidth - 16),
        height: clamp(parsed.height, 320, window.innerHeight - 16),
      };
    }
  } catch {
    /* ignore */
  }
  return {
    x: Math.max(16, window.innerWidth - 404),
    y: 72,
    width: 380,
    height: Math.min(640, window.innerHeight - 96),
  };
}