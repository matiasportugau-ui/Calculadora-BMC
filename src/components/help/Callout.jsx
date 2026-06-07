import { useHelp } from "./useHelp.js";
import { useFirstTimeTipState } from "./useHelp.js";

/**
 * Callout banner persistente. Usa helpText.long.
 *
 *   <Callout id="batch-modal" variant="info" dismissible />
 *
 * variants: "info" (default), "warn", "success"
 * Si dismissible=true, persiste el dismissal en localStorage por id.
 */
export default function Callout({ id, variant = "info", dismissible = false }) {
  const step = useHelp(id);
  const { dismissed, dismiss } = useFirstTimeTipState(id);

  if (!step) return null;
  if (dismissible && dismissed) return null;

  const text = step.helpText?.long || step.helpText?.short;
  if (!text) return null;

  return (
    <aside
      className="acHelp-callout"
      data-variant={variant}
      role="note"
      aria-label={step.intent || "Información"}
    >
      <div className="acHelp-callout-body">
        {step.intent && <strong className="acHelp-callout-intent">{step.intent}</strong>}
        <p className="acHelp-callout-text">{text}</p>
      </div>
      {dismissible && (
        <button
          type="button"
          className="acHelp-callout-dismiss"
          aria-label="Descartar"
          onClick={dismiss}
        >
          ✕
        </button>
      )}
    </aside>
  );
}
