/**
 * F10b — reorderable package list (HTML5 DnD).
 */
import { packageLabelCompact } from "../../utils/logistica/packageIdentity.js";
import { buildPackageListRows, reorderManualKeys, moveManualKeyBy } from "../../utils/logistica/packageListDnD.js";
import { ENV_T as T } from "../../utils/enviosTheme.js";
import { btnStyle } from "../../utils/logistica/btnStyle.js";

function MiniBtn({ children, onClick, disabled, active }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={btnStyle({
        small: true,
        outline: true,
        disabled,
        active,
        style: { padding: "4px 8px", fontSize: 11 },
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

  const onDragStart = (e, key) => {
    e.dataTransfer.setData("text/plain", key);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (e, overKey) => {
    e.preventDefault();
    const activeKey = e.dataTransfer.getData("text/plain");
    if (!activeKey || !onReorder) return;
    const next = reorderManualKeys(manualKeys.length ? manualKeys : rows.map((r) => r.stableKey), activeKey, overKey);
    onReorder(next);
  };

  if (!rows.length) {
    return (
      <div style={{ fontSize: 12, color: T.muted, padding: 8 }}>
        Sin bultos en el camión. Agregá paradas con paneles.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".04em" }}>
        Bultos · arrastrá para reordenar (manual)
      </div>
      {rows.map((row) => {
        const selected = selectedStableKey === row.stableKey;
        return (
          <div
            key={row.stableKey}
            draggable
            onDragStart={(e) => onDragStart(e, row.stableKey)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, row.stableKey)}
            onClick={() => onSelect?.(row.pkg)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 10,
              border: selected ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
              background: selected ? "#eff6ff" : T.surface,
              cursor: "grab",
            }}
          >
            <span style={{ color: T.muted, fontSize: 14, userSelect: "none" }} title="Arrastrar">
              ⠿
            </span>
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
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
              <div style={{ fontSize: 10, color: T.muted }}>
                Fila {row.row === 1 ? "B" : "A"} · {row.pkg?.tipo || "—"} · {(row.pkg?.len ?? 0).toFixed?.(1) || row.pkg?.len}m
                {row.pkg?.kind === "accessory" ? " · no soporta paneles encima" : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
              <MiniBtn onClick={() => onForceRow?.(row.stableKey, 0)} active={row.row === 0}>
                A
              </MiniBtn>
              <MiniBtn onClick={() => onForceRow?.(row.stableKey, 1)} active={row.row === 1}>
                B
              </MiniBtn>
              <MiniBtn
                onClick={() => {
                  const base = manualKeys.length ? manualKeys : rows.map((r) => r.stableKey);
                  onReorder?.(moveManualKeyBy(base, row.stableKey, -1));
                }}
              >
                ↑
              </MiniBtn>
              <MiniBtn
                onClick={() => {
                  const base = manualKeys.length ? manualKeys : rows.map((r) => r.stableKey);
                  onReorder?.(moveManualKeyBy(base, row.stableKey, 1));
                }}
              >
                ↓
              </MiniBtn>
            </div>
          </div>
        );
      })}
    </div>
  );
}
