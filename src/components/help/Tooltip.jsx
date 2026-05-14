import { useState } from "react";
import { useHelp } from "./useHelp.js";

/**
 * Tooltip ephemeral — aparece en hover/focus. Usa helpText.short.
 *
 *   <Tooltip id="kpi-stale"><Stat ... /></Tooltip>
 *
 * Si el id no existe en source.json, renderiza solo `children` sin overhead.
 */
export default function Tooltip({ id, children, placement = "top" }) {
  const step = useHelp(id);
  const [open, setOpen] = useState(false);

  if (!step?.helpText?.short) return children;

  return (
    <span
      className="acHelp-tooltip-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span role="tooltip" className="acHelp-tooltip" data-placement={placement}>
          {step.helpText.short}
        </span>
      )}
    </span>
  );
}
