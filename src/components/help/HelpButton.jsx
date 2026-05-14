import { useEffect, useRef, useState } from "react";
import { useHelp } from "./useHelp.js";

/**
 * Botón "?" que abre un popover con helpText.long.
 *
 *   <HelpButton id="batch-modal" />
 *
 * Si el id no existe en source.json, renderiza nada.
 */
export default function HelpButton({ id, label = "Más info" }) {
  const step = useHelp(id);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!step) return null;

  return (
    <span className="acHelp-button-wrap" ref={ref}>
      <button
        type="button"
        className="acHelp-button"
        aria-label={`${label}: ${step.intent || ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={step.intent || "Ayuda"}
          className="acHelp-popover"
        >
          <header className="acHelp-popover-header">
            <strong>{step.intent || "Ayuda"}</strong>
            <button
              type="button"
              className="acHelp-popover-close"
              aria-label="Cerrar"
              onClick={() => setOpen(false)}
            >
              ✕
            </button>
          </header>
          <div className="acHelp-popover-body">
            <p>{step.helpText?.long || step.helpText?.short || "—"}</p>
            {step.screenshot && step.helpText?.long && (
              <p className="acHelp-popover-foot">
                Ejemplo visual en <code>{step.screenshot}</code>
              </p>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
