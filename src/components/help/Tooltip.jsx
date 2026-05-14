import { cloneElement, isValidElement, useId, useState } from "react";
import { useHelp } from "./useHelp.js";

/**
 * Tooltip ephemeral — aparece en hover/focus. Usa helpText.short.
 *
 *   <Tooltip id={HELP_ANCHORS.KPI_STALE}><Stat ... /></Tooltip>
 *
 * Si el id no existe en source.json, renderiza solo `children` sin overhead.
 *
 * a11y: `aria-describedby` se inyecta en el child interactivo (no en el
 * wrapper), porque el foco aterriza ahí y el screen reader anuncia la
 * descripción del elemento focused. Si el child ya tiene aria-describedby,
 * se preserva (space-separated, per spec).
 */
export default function Tooltip({ id, children, placement = "top" }) {
  const step = useHelp(id);
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  if (!step?.helpText?.short) return children;

  const child = isValidElement(children)
    ? cloneElement(children, {
        "aria-describedby": open
          ? [children.props["aria-describedby"], tooltipId].filter(Boolean).join(" ")
          : children.props["aria-describedby"],
      })
    : children;

  return (
    <span
      className="acHelp-tooltip-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {child}
      {open && (
        <span id={tooltipId} role="tooltip" className="acHelp-tooltip" data-placement={placement}>
          {step.helpText.short}
        </span>
      )}
    </span>
  );
}
