import { useId, useState } from "react";
import { useHelp } from "./useHelp.js";

/**
 * Tooltip ephemeral — aparece en hover/focus. Usa helpText.short.
 *
 *   <Tooltip id={HELP_ANCHORS.KPI_STALE}><Stat ... /></Tooltip>
 *
 * Si el id no existe en source.json, renderiza solo `children` sin overhead.
 * `aria-describedby` se setea cuando el tooltip está abierto para que los
 * screen readers anuncien el helpText.short.
 */
export default function Tooltip({ id, children, placement = "top" }) {
  const step = useHelp(id);
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  if (!step?.helpText?.short) return children;

  return (
    <span
      className="acHelp-tooltip-wrap"
      aria-describedby={open ? tooltipId : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span id={tooltipId} role="tooltip" className="acHelp-tooltip" data-placement={placement}>
          {step.helpText.short}
        </span>
      )}
    </span>
  );
}
