/**
 * Envío Setup Wizard shell — chip stages (SDD-ENVIO-WIZARD).
 * Compact: one open step + thumb Continuar. Ruta keeps Mesa de ruta.
 */
import {
  WIZARD_STEPS,
  isStepComplete,
  stepSummary,
  stepMissingHints,
  tryCompleteStep,
  createWizardUi,
} from "../../../utils/logistica/wizardState.js";
import "../../../styles/ruta-desk.css";

const STEP_LABELS = {
  pedidos: "1 · Pedidos",
  flota: "2 · Flota",
  levantes: "3 · Levantes",
  ruta: "4 · Ruta",
  carga: "5 · Carga",
};

/**
 * @param {object} props
 */
export default function EnvioWizardShell({
  wizard,
  onWizardChange,
  ctx,
  places = [],
  onClassic,
  childrenByStep,
  headerActions = null,
  onCargarActuales = null,
  loadSh = false,
}) {
  const w = createWizardUi(wizard || {});
  const active = w.activeStep;
  const desk = active === "ruta";

  const openStep = (step) => {
    onWizardChange?.(createWizardUi({ ...w, activeStep: step }));
  };

  const onContinuar = () => {
    const result = tryCompleteStep(active, w, ctx);
    if (!result.ok) return result;
    onWizardChange?.(result.wizard);
    return result;
  };

  const onAtras = () => {
    const i = WIZARD_STEPS.indexOf(active);
    if (i > 0) openStep(WIZARD_STEPS[i - 1]);
  };

  const missing = stepMissingHints(active, ctx);
  const summary = stepSummary(active, ctx, places);
  const canContinue = missing.length === 0 || active === "carga";

  return (
    <div
      className={`envios-wizard envios-wizard--desk${desk ? "" : " envios-wizard--setup"}`}
      data-testid="envios-wizard-shell"
      data-active-step={active}
    >
      <div className="envios-wizard-steps-compact">
        {WIZARD_STEPS.map((step) => {
          const done = w.done?.[step] || isStepComplete(step, ctx);
          return (
            <button
              key={step}
              type="button"
              className={step === active ? "is-on" : ""}
              onClick={() => openStep(step)}
            >
              {done && step !== active ? "✓ " : ""}
              {STEP_LABELS[step]}
            </button>
          );
        })}
        {typeof onClassic === "function" ? (
          <button type="button" onClick={onClassic} style={{ marginLeft: "auto" }}>
            Detalle Completo
          </button>
        ) : null}
      </div>

      {!desk ? (
        <div className="envios-wizard-setup-head">
          <div className="envios-wizard-setup-head__copy">
            <div className="envios-wizard-setup-head__title">{STEP_LABELS[active] || "Configuración"}</div>
            <div className="envios-wizard-setup-head__sub">{summary || "Completá esta etapa"}</div>
          </div>
          <div className="envios-wizard-setup-head__actions">{headerActions}</div>
        </div>
      ) : null}

      <div className={desk ? "envios-wizard-desk-body" : "envios-wizard-setup-body"}>
        {childrenByStep?.[active] || null}
        {!desk && missing.length ? (
          <div className="envios-wizard-missing" data-testid="envios-wizard-missing">
            Falta: {missing.join(" · ")}
          </div>
        ) : null}
      </div>

      {!desk ? (
        <div className="ruta-desk-thumb envios-wizard-thumb" data-testid="envios-wizard-thumb">
          <button
            type="button"
            className="ruta-desk-thumb__secondary"
            onClick={onAtras}
            disabled={active === "pedidos"}
          >
            Atrás
          </button>
          {active === "pedidos" && typeof onCargarActuales === "function" ? (
            <button
              type="button"
              className="ruta-desk-thumb__secondary"
              onClick={onCargarActuales}
              disabled={loadSh}
            >
              {loadSh ? "…" : "Cargar"}
            </button>
          ) : null}
          <button
            type="button"
            className="ruta-desk-thumb__primary"
            onClick={() => {
              const r = onContinuar();
              if (r && !r.ok) return;
            }}
            disabled={!canContinue}
          >
            {active === "carga" ? "Listo" : "Continuar"}
          </button>
        </div>
      ) : null}

      <div className="envios-wizard-inline-nav" data-testid="envios-wizard-inline-nav">
        <button type="button" onClick={onAtras} disabled={active === "pedidos"} style={btnSecondary}>
          ← Atrás
        </button>
        {active === "pedidos" && typeof onCargarActuales === "function" ? (
          <button type="button" onClick={onCargarActuales} disabled={loadSh} style={btnSecondary}>
            {loadSh ? "Cargando…" : "Cargar actuales"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            const r = onContinuar();
            if (r && !r.ok) return;
          }}
          disabled={!canContinue}
          style={{ ...btnPrimary, opacity: canContinue ? 1 : 0.5 }}
        >
          {active === "carga" ? "Listo" : "Continuar →"}
        </button>
      </div>
    </div>
  );
}

const btnPrimary = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  minHeight: 44,
  touchAction: "manipulation",
};
const btnSecondary = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  minHeight: 44,
  touchAction: "manipulation",
};
