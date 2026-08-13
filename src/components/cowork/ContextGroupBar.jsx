/**
 * Multi-context tab strip — groups + tabs, scroll not wrap.
 */
import React, { useState } from "react";
import { TAB_KINDS } from "../../hooks/useContextGroups.js";

const barStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "6px 8px 4px",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.18)",
  flexShrink: 0,
  minWidth: 0,
};

const scrollRow = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "nowrap",
  minHeight: 28,
  overflowX: "auto",
  overflowY: "hidden",
  WebkitOverflowScrolling: "touch",
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
  flexShrink: 0,
  whiteSpace: "nowrap",
};

export default function ContextGroupBar({
  groups,
  activeGroupId,
  activeGroup,
  setActiveGroupId,
  setFocusTab,
  addTab,
  addGroup,
  renameGroup,
  kindLabel,
  workspaceOpen = false,
  setWorkspaceOpen,
  onShareKind,
  disabled = false,
}) {
  const tabs = activeGroup?.tabs || [];
  const focusId = activeGroup?.focusTabId;
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

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
  };

  if (!workspaceOpen) {
    return (
      <div style={barStyle} data-testid="pmca-context-group-bar">
        <button
          type="button"
          data-no-drag
          disabled={disabled}
          onClick={() => setWorkspaceOpen?.(true)}
          style={{ ...chipBase, fontWeight: 700, padding: "6px 12px", fontSize: 12 }}
        >
          Workspace ▾
        </button>
      </div>
    );
  }

  return (
    <div style={barStyle} data-testid="pmca-context-group-bar">
      <div style={scrollRow} role="group" aria-label="Grupos de contexto">
        <button
          type="button"
          data-no-drag
          onClick={() => setWorkspaceOpen?.(false)}
          style={{ ...chipBase, fontWeight: 700 }}
          title="Ocultar workspace"
        >
          Workspace ▴
        </button>
        {groups.map((g) => {
          const active = g.id === activeGroupId;
          if (active && renaming) {
            return (
              <input
                key={g.id}
                data-no-drag
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => {
                  renameGroup?.(renameDraft);
                  setRenaming(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    renameGroup?.(renameDraft);
                    setRenaming(false);
                  }
                  if (e.key === "Escape") setRenaming(false);
                }}
                style={{ ...chipBase, width: 110, background: "rgba(255,255,255,0.15)" }}
              />
            );
          }
          return (
            <button
              key={g.id}
              type="button"
              data-no-drag
              disabled={disabled}
              onClick={() => setActiveGroupId(g.id)}
              onDoubleClick={() => {
                setRenameDraft(g.label || "");
                setRenaming(true);
              }}
              aria-pressed={active}
              title={`${g.label} — doble clic para renombrar`}
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

      <div style={{ ...scrollRow, position: "relative" }} role="tablist" aria-label={`Pestañas de ${activeGroup?.label || "workspace"}`}>
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
              onClick={() => {
                setFocusTab(t.id);
                onShareKind?.(t.kind, t.id);
              }}
              onKeyDown={(e) => onTabKeyDown(e, index)}
              style={{
                ...chipBase,
                background: selected ? "rgba(255,255,255,0.18)" : chipBase.background,
                fontWeight: selected ? 650 : 500,
              }}
            >
              {t.label || kindLabel(t.kind)}
              {t.share?.live ? " ●" : ""}
            </button>
          );
        })}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            data-no-drag
            disabled={disabled}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Agregar pestaña"
            style={{ ...chipBase, opacity: 0.8 }}
            title="Seleccioná la pestaña a compartir"
          >
            + Tab
          </button>
          {menuOpen && (
            <div
              data-no-drag
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                zIndex: 20,
                minWidth: 140,
                background: "#1d1d1f",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                padding: 4,
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ ...chipBase, border: "none", cursor: "default", opacity: 0.7, fontSize: 10 }}>
                Seleccioná la pestaña a compartir
              </div>
              {TAB_KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  data-no-drag
                  onClick={() => {
                    addTab(k.kind, k.label);
                    setMenuOpen(false);
                    onShareKind?.(k.kind, null);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    ...chipBase,
                    background: "transparent",
                    border: "none",
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
