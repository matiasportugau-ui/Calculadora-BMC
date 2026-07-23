/**
 * Multi-context tab strip (Claude-style group + tabs) for Panelin Co-Work.
 * Accessibility: role=tablist / tab / tabpanel semantics on the strip.
 */
import React from "react";

const barStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "6px 10px 4px",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.18)",
  flexShrink: 0,
};

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
  minHeight: 28,
};

const chipBase = {
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.85)",
  borderRadius: 6,
  padding: "3px 8px",
  fontSize: 11,
  cursor: "pointer",
  fontFamily: "inherit",
  lineHeight: 1.3,
};

/**
 * @param {{
 *   groups: object[],
 *   activeGroupId: string,
 *   activeGroup: object,
 *   setActiveGroupId: (id: string) => void,
 *   setFocusTab: (id: string) => void,
 *   addTab: (kind: string) => void,
 *   addGroup: () => void,
 *   kindLabel: (k: string) => string,
 *   disabled?: boolean,
 * }} props
 */
export default function ContextGroupBar({
  groups,
  activeGroupId,
  activeGroup,
  setActiveGroupId,
  setFocusTab,
  addTab,
  addGroup,
  kindLabel,
  disabled = false,
}) {
  const tabs = activeGroup?.tabs || [];
  const focusId = activeGroup?.focusTabId;

  const onTabKeyDown = (e, index) => {
    if (disabled || tabs.length === 0) return;
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    setFocusTab(tabs[next].id);
    const el = document.getElementById(`pmca-tab-${tabs[next].id}`);
    el?.focus?.();
  };

  return (
    <div style={barStyle} data-testid="pmca-context-group-bar">
      <div style={rowStyle} role="group" aria-label="Grupos de contexto">
        {groups.map((g) => {
          const active = g.id === activeGroupId;
          return (
            <button
              key={g.id}
              type="button"
              data-no-drag
              disabled={disabled}
              onClick={() => setActiveGroupId(g.id)}
              aria-pressed={active}
              title={g.label}
              style={{
                ...chipBase,
                fontWeight: active ? 700 : 500,
                background: active ? "rgba(96,165,250,0.35)" : chipBase.background,
                borderColor: active ? "rgba(96,165,250,0.7)" : chipBase.border,
              }}
            >
              {g.label}
            </button>
          );
        })}
        <button
          type="button"
          data-no-drag
          disabled={disabled}
          onClick={addGroup}
          aria-label="Nuevo grupo de contexto"
          style={{ ...chipBase, opacity: 0.85 }}
        >
          + Grupo
        </button>
      </div>

      <div
        style={rowStyle}
        role="tablist"
        aria-label={`Pestañas de ${activeGroup?.label || "workspace"} — compartidas con el agente`}
      >
        {tabs.map((t, index) => {
          const selected = t.id === focusId;
          return (
            <button
              key={t.id}
              id={`pmca-tab-${t.id}`}
              type="button"
              data-no-drag
              role="tab"
              disabled={disabled}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setFocusTab(t.id)}
              onKeyDown={(e) => onTabKeyDown(e, index)}
              style={{
                ...chipBase,
                background: selected ? "rgba(255,255,255,0.18)" : chipBase.background,
                fontWeight: selected ? 650 : 500,
              }}
            >
              {t.label || kindLabel(t.kind)}
            </button>
          );
        })}
        <button
          type="button"
          data-no-drag
          disabled={disabled}
          onClick={() => addTab("note")}
          aria-label="Agregar pestaña nota"
          style={{ ...chipBase, opacity: 0.8 }}
          title="Agregar pestaña (nota)"
        >
          + Tab
        </button>
        <span style={{ fontSize: 10, opacity: 0.55, marginLeft: 4 }}>
          shared · agente ve todas
        </span>
      </div>
    </div>
  );
}
