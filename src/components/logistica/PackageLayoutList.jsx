/**
 * F10b — reorderable package list.
 * Pointer-events DnD (trackpad + mouse + touch/tablet) — not HTML5 DnD only.
 * Also ↑↓ buttons for accessibility / small screens.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { packageLabelCompact } from "../../utils/logistica/packageIdentity.js";
import { buildPackageListRows, reorderManualKeys, moveManualKeyBy } from "../../utils/logistica/packageListDnD.js";
import { ENV_T as T } from "../../utils/enviosTheme.js";
import { btnStyle } from "../../utils/logistica/btnStyle.js";

function MiniBtn({ children, onClick, disabled, active, title }) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      style={btnStyle({
        small: true,
        outline: true,
        disabled,
        active,
        style: {
          padding: "8px 12px",
          fontSize: 13,
          minWidth: 40,
          minHeight: 40,
          touchAction: "manipulation",
        },
      })}
    >
      {children}
    </button>
  );
}

/**
 * @param {{
 *   placed: object[],
 *   counts: Map|null,
 *   manualKeys: string[],
 *   onReorder: (keys: string[]) => void,
 *   onForceRow?: (stableKey: string, row: number) => void,
 *   selectedStableKey?: string|null,
 *   onSelect?: (pkg: object) => void,
 * }} props
 */
export default function PackageLayoutList({
  placed = [],
  counts = null,
  manualKeys = [],
  onReorder,
  onForceRow,
  selectedStableKey = null,
  onSelect,
}) {
  const rows = buildPackageListRows(placed, counts, manualKeys);
  const listRef = useRef(null);
  const dragRef = useRef(null);
  const [activeKey, setActiveKey] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const [ghostY, setGhostY] = useState(null);

  const keyOrder = useCallback(() => {
    return manualKeys.length ? manualKeys : rows.map((r) => r.stableKey);
  }, [manualKeys, rows]);

  const findKeyAtPoint = useCallback((clientX, clientY) => {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el || !listRef.current?.contains(el)) return null;
    const row = el.closest?.("[data-stable-key]");
    return row?.getAttribute("data-stable-key") || null;
  }, []);

  const endPointerDrag = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d) return;
      try {
        d.handle?.releasePointerCapture?.(d.pointerId);
      } catch {
        /* ignore */
      }
      const from = d.activeKey;
      const to = overKey || findKeyAtPoint(e?.clientX ?? 0, e?.clientY ?? 0);
      dragRef.current = null;
      setActiveKey(null);
      setOverKey(null);
      setGhostY(null);
      if (!from || !onReorder) return;
      if (to && to !== from) {
        const next = reorderManualKeys(keyOrder(), from, to);
        onReorder(next);
      }
    },
    [overKey, findKeyAtPoint, onReorder, keyOrder],
  );

  const onHandlePointerDown = useCallback(
    (e, key) => {
      // Only primary button / touch / pen
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const handle = e.currentTarget;
      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      dragRef.current = {
        pointerId: e.pointerId,
        activeKey: key,
        handle,
        startY: e.clientY,
        moved: false,
      };
      setActiveKey(key);
      setOverKey(key);
      setGhostY(e.clientY);
    },
    [],
  );

  const onHandlePointerMove = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      e.preventDefault();
      if (Math.abs(e.clientY - d.startY) > 4) d.moved = true;
      setGhostY(e.clientY);
      const k = findKeyAtPoint(e.clientX, e.clientY);
      if (k) setOverKey(k);
    },
    [findKeyAtPoint],
  );

  const onHandlePointerUp = useCallback(
    (e) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      e.preventDefault();
      endPointerDrag(e);
    },
    [endPointerDrag],
  );

  // Safety: end drag if pointer is lost globally
  useEffect(() => {
    const onUp = (e) => {
      if (dragRef.current) endPointerDrag(e);
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [endPointerDrag]);

  if (!rows.length) {
    return (
      <div style={{ fontSize: 12, color: T.muted, padding: 8 }}>
        Sin bultos en el camión. Agregá paradas con paneles.
      </div>
    );
  }

  return (
    <div ref={listRef} style={{ display: "grid", gap: 6, position: "relative", touchAction: "pan-y" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em" }}>
        Bultos · arrastrá el ⠿ (trackpad / dedo) o usá ↑↓
      </div>
      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.35, marginBottom: 2 }}>
        Trackpad y tablet: mantené y deslizá desde el asa ⠿. En móvil los botones ↑↓ y A/B son más grandes.
      </div>
      {rows.map((row) => {
        const selected = selectedStableKey === row.stableKey;
        const isDragging = activeKey === row.stableKey;
        const isOver = overKey === row.stableKey && activeKey && activeKey !== row.stableKey;
        return (
          <div
            key={row.stableKey}
            data-stable-key={row.stableKey}
            onClick={() => {
              if (dragRef.current?.moved) return;
              onSelect?.(row.pkg);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 10px",
              borderRadius: 10,
              border: isOver
                ? `2px solid ${T.primary}`
                : selected
                  ? `1.5px solid ${T.primary}`
                  : `1px solid ${T.border}`,
              background: isDragging ? "#dbeafe" : selected ? "#eff6ff" : T.surface,
              opacity: isDragging ? 0.85 : 1,
              boxShadow: isOver ? `0 0 0 2px ${T.primary}33` : undefined,
              minHeight: 52,
              WebkitUserSelect: "none",
              userSelect: "none",
            }}
          >
            <button
              type="button"
              aria-label={`Arrastrar bulto ${packageLabelCompact(row.pkg, counts)}`}
              title="Arrastrar (trackpad / touch / mouse)"
              onPointerDown={(e) => onHandlePointerDown(e, row.stableKey)}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerUp}
              style={{
                color: T.muted,
                fontSize: 18,
                lineHeight: 1,
                padding: "10px 12px",
                margin: -6,
                border: "none",
                background: isDragging ? "#bfdbfe" : "transparent",
                borderRadius: 8,
                cursor: isDragging ? "grabbing" : "grab",
                touchAction: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
                flexShrink: 0,
                minWidth: 44,
                minHeight: 44,
              }}
            >
              ⠿
            </button>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: row.pkg?.sCol || T.primary,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: T.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {packageLabelCompact(row.pkg, counts)}
                {row.pkg?.kind === "accessory" || String(row.pkg?.tipo || "").toUpperCase() === "ACCESORIOS" ? (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: ".04em",
                      color: "#92400e",
                      background: "#fef3c7",
                      borderRadius: 4,
                      padding: "1px 5px",
                      verticalAlign: "middle",
                    }}
                    title="No se pueden apilar paneles sobre este bulto"
                  >
                    PERFIL
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: 11, color: T.muted }}>
                Fila {row.row === 1 ? "B" : "A"} · {row.pkg?.tipo || "—"} ·{" "}
                {(row.pkg?.len ?? 0).toFixed?.(1) || row.pkg?.len}m
                {row.pkg?.kind === "accessory" ? " · no soporta paneles encima" : ""}
              </div>
            </div>
            <div
              style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <MiniBtn
                title="Fila A"
                onClick={() => onForceRow?.(row.stableKey, 0)}
                active={row.row === 0}
              >
                A
              </MiniBtn>
              <MiniBtn
                title="Fila B"
                onClick={() => onForceRow?.(row.stableKey, 1)}
                active={row.row === 1}
              >
                B
              </MiniBtn>
              <MiniBtn
                title="Subir en la lista"
                onClick={() => {
                  const base = keyOrder();
                  onReorder?.(moveManualKeyBy(base, row.stableKey, -1));
                }}
              >
                ↑
              </MiniBtn>
              <MiniBtn
                title="Bajar en la lista"
                onClick={() => {
                  const base = keyOrder();
                  onReorder?.(moveManualKeyBy(base, row.stableKey, 1));
                }}
              >
                ↓
              </MiniBtn>
            </div>
          </div>
        );
      })}
      {activeKey && ghostY != null ? (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            top: ghostY - 20,
            zIndex: 9999,
            pointerEvents: "none",
            opacity: 0.55,
            padding: "8px 12px",
            borderRadius: 10,
            background: "#1e3a5f",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            maxWidth: 360,
            margin: "0 auto",
            boxShadow: "0 8px 24px rgba(0,0,0,.25)",
          }}
        >
          Moviendo bulto… soltá sobre la fila destino
        </div>
      ) : null}
    </div>
  );
}
