import { useHelp, useFirstTimeTipState } from "./useHelp.js";

/**
 * Tip de primer uso — aparece una vez y se descarta para siempre.
 *
 *   <FirstTimeTip id="batch-modal" placement="bottom" />
 *
 * Se posiciona anclado al elemento padre con position:relative. Si el id
 * ya fue descartado, no renderiza nada (sin overhead). El usuario puede
 * resetear todos los dismissed con useResetHelp().
 */
export default function FirstTimeTip({ id, placement = "bottom" }) {
  const step = useHelp(id);
  const { dismissed, dismiss } = useFirstTimeTipState(id);

  if (!step || dismissed) return null;

  const short = step.helpText?.short;
  const long = step.helpText?.long;
  if (!short) return null;

  return (
    <div
      role="status"
      className="acHelp-ftt"
      data-placement={placement}
      aria-live="polite"
    >
      <div className="acHelp-ftt-body">
        <strong className="acHelp-ftt-intent">{step.intent || "Tip"}</strong>
        <p className="acHelp-ftt-short">{short}</p>
        {long && long !== short && <p className="acHelp-ftt-long">{long}</p>}
      </div>
      <button
        type="button"
        className="acHelp-ftt-dismiss"
        onClick={dismiss}
      >
        Entendido
      </button>
    </div>
  );
}
