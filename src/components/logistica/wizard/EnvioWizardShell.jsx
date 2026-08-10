/**
 * Envío Setup Wizard shell — accordion stages (SDD-ENVIO-WIZARD).
 * Pure presentation + callbacks; no packing logic.
 */
import { ENV_T as T } from "../../../utils/enviosTheme.js";
import {
  WIZARD_STEPS,
  isStepComplete,
  stepSummary,
  stepMissingHints,
  tryCompleteStep,
  createWizardUi,
} from "../../../utils/logistica/wizardState.js";

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
}) {
  const w = createWizardUi(wizard || {});
  const active = w.activeStep;

  const openStep = (step) => {
    onWizardChange?.(createWizardUi({ ...w, activeStep: step }));
  };

  const onContinuar = () => {
    const result = tryCompleteStep(active, w, ctx);
    if (!result.ok) return result;
    // apply levantes default when completing levantes
    onWizardChange?.(result.wizard);
    return result;
  };

  const onAtras = () => {
    const i = WIZARD_STEPS.indexOf(active);
    if (i > 0) openStep(WIZARD_STEPS[i - 1]);
  };

  const missing = stepMissingHints(active, ctx);

  return (
    <div
      className="envios-wizard"
      style={{
        marginBottom: 16,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        background: T.surface || "#fff",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "12px 14px",
          borderBottom: `1px solid ${T.border}`,
          background: "linear-gradient(180deg,#f8fafc,#fff)",
        }}
      >
        <div style={{ minWidth: 0, flex: "1 1 160px" }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: T.brand || "#1e3a5f" }}>
            Configuración del envío
          </div>
          <div style={{ fontSize: 11, color: T.muted }}>
            Completá cada etapa · se resume al avanzar (como la calculadora)
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
          {headerActions}
          {typeof onClassic === "function" ? (
            <button
              type="button"
              onClick={onClassic}
              style={{
                fontSize: 12,
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: "#fff",
                cursor: "pointer",
                minHeight: 40,
                fontWeight: 600,
              }}
            >
              Detalle Completo
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ padding: 10, display: "grid", gap: 8 }}>
        {WIZARD_STEPS.map((step) => {
          const done = w.done?.[step] || isStepComplete(step, ctx);
          const open = active === step;
          const summary = stepSummary(step, ctx, places);
          return (
            <div
              key={step}
              style={{
                border: open ? `1.5px solid ${T.primary || "#2563eb"}` : `1px solid ${T.border}`,
                borderRadius: 12,
                background: open ? "#f8fafc" : done ? "#f0fdf4" : "#fff",
              }}
            >
              <button
                type="button"
                onClick={() => openStep(step)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  padding: "12px 14px",
                  cursor: "pointer",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  minHeight: 48,
                }}
              >
                <span style={{ fontSize: 16, width: 22 }}>{done && !open ? "✓" : open ? "▼" : "○"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.text }}>{STEP_LABELS[step]}</div>
                  {!open ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: T.muted,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {summary || "Pendiente"}
                    </div>
                  ) : null}
                </div>
              </button>
              {open ? (
                <div style={{ padding: "0 14px 14px", borderTop: `1px solid ${T.border}` }}>
                  <div style={{ paddingTop: 12 }}>{childrenByStep?.[step] || null}</div>
                  {missing.length ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "#fff7ed",
                        border: "1px solid #fed7aa",
                        fontSize: 12,
                        color: "#9a3412",
                      }}
                    >
                      Falta: {missing.join(" · ")}
                    </div>
                  ) : null}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 12,
                      flexWrap: "wrap",
                      justifyContent: "space-between",
                      position: "sticky",
                      bottom: 0,
                      paddingTop: 8,
                      background: "linear-gradient(transparent, #f8fafc 30%)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={onAtras}
                      disabled={step === "pedidos"}
                      style={btnSecondary}
                    >
                      ← Atrás
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const r = onContinuar();
                        if (r && !r.ok) return;
                      }}
                      disabled={missing.length > 0 && step !== "carga"}
                      style={{
                        ...btnPrimary,
                        opacity: missing.length > 0 && step !== "carga" ? 0.5 : 1,
                      }}
                    >
                      {step === "carga" ? "Listo" : "Continuar →"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
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
};
