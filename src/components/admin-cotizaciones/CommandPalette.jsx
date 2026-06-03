import { useEffect, useMemo, useRef, useState } from "react";
import { SKINS } from "./SkinProvider.jsx";
import { useSkin } from "./useSkin.js";

export default function CommandPalette({
  open, onClose,
  onRefresh, onRunBatch, onRunSync, onExport,
  onOpenLegacy, onChangeToken,
}) {
  const { setSkin } = useSkin();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => [
    { id: "refresh", label: "Recargar pendientes", run: () => { onRefresh?.(); onClose(); } },
    { id: "batch", label: "Generar IA en lote", run: () => { onRunBatch?.(); onClose(); } },
    { id: "sync", label: "Sincronizar a CRM", run: () => { onRunSync?.(); onClose(); } },
    { id: "export", label: "Exportar CSV", run: () => { onExport?.(); onClose(); } },
    { id: "token", label: "Cambiar token", run: () => { onChangeToken?.(); onClose(); } },
    { id: "legacy", label: "Ir al módulo viejo (/hub/admin?legacy=1)", run: () => { onOpenLegacy?.(); onClose(); } },
    ...SKINS.map((s) => ({
      id: `skin-${s.id}`,
      label: `Skin: ${s.label}`,
      run: () => { setSkin(s.id); onClose(); },
    })),
  ], [onRefresh, onRunBatch, onRunSync, onExport, onChangeToken, onOpenLegacy, setSkin, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.label.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const it = filtered[active];
        if (it) it.run();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, filtered, active, onClose]);

  if (!open) return null;
  return (
    <div
      className="adminCot__palette-backdrop"
      data-tutorial-id="command-palette"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="adminCot__palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
        <input
          ref={inputRef}
          className="adminCot__palette-input"
          placeholder="Buscar acción…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar acción"
        />
        <div className="adminCot__palette-list" role="listbox">
          {filtered.length === 0 ? (
            <div className="adminCot__palette-empty">Sin coincidencias.</div>
          ) : filtered.map((it, i) => (
            <button
              key={it.id}
              type="button"
              role="option"
              aria-selected={active === i}
              data-active={active === i}
              className="adminCot__palette-item"
              onMouseEnter={() => setActive(i)}
              onClick={() => it.run()}
            >
              {it.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
