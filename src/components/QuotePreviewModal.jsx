import { createPortal } from "react-dom";

const SCENARIO_LABELS = {
  camara_frig: "Cámara frigorífica",
  solo_techo: "Solo techo",
  solo_fachada: "Solo fachada",
  techo_fachada: "Techo + fachada",
};

function fmtUSD(n) {
  return `U$S ${Number(n).toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DimRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "2px 0" }}>
      <span style={{ color: "#6e6e73" }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

/**
 * QuotePreviewModal — shown when the bot emits a buildQuote action.
 *
 * Props:
 *   pendingQuote: { payload, preview, warnings } | null
 *   onConfirm()   — apply the quote
 *   onDiscard()   — close without applying
 *   onAdjust(msg) — send a follow-up message to the bot
 */
export default function QuotePreviewModal({ pendingQuote, onConfirm, onDiscard, onAdjust }) {
  if (!pendingQuote) return null;

  const { payload, preview, warnings = [] } = pendingQuote;
  const scenario = payload?.scenario || "";
  const techo = payload?.techo;
  const pared = payload?.pared;
  const camara = payload?.camara;

  const modal = (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onDiscard(); }}
    >
      <div
        style={{
          background: "#fff", borderRadius: 14, boxShadow: "0 8px 48px rgba(0,0,0,0.22)",
          width: "100%", maxWidth: 420, maxHeight: "90vh", overflow: "auto",
          padding: "20px 20px 16px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: "#e8f4fd",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontSize: 16 }}>📋</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1d1d1f" }}>
              Cotización propuesta
            </div>
            <div style={{ fontSize: 12, color: "#6e6e73" }}>
              {SCENARIO_LABELS[scenario] || scenario}
            </div>
          </div>
        </div>

        {/* Dimensions / config */}
        <div style={{ background: "#f5f5f7", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
          {techo && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#3c3c43", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Techo</div>
              <DimRow label="Familia" value={techo.familia} />
              <DimRow label="Espesor" value={techo.espesor ? `${techo.espesor} mm` : null} />
              <DimRow label="Color" value={techo.color} />
              {Array.isArray(techo.zonas) && techo.zonas.length > 0 && (
                <DimRow
                  label="Dimensiones"
                  value={techo.zonas.map((z) => `${z.largo}×${z.ancho} m`).join(", ")}
                />
              )}
            </>
          )}
          {pared && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#3c3c43", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: techo ? 8 : 0, marginBottom: 4 }}>Pared</div>
              <DimRow label="Familia" value={pared.familia} />
              <DimRow label="Espesor" value={pared.espesor ? `${pared.espesor} mm` : null} />
              <DimRow label="Alto" value={pared.alto ? `${pared.alto} m` : null} />
              <DimRow label="Perímetro" value={pared.perimetro ? `${pared.perimetro} m` : null} />
            </>
          )}
          {camara && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#3c3c43", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: (techo || pared) ? 8 : 0, marginBottom: 4 }}>Cámara (interior)</div>
              <DimRow label="Largo" value={camara.largo_int ? `${camara.largo_int} m` : null} />
              <DimRow label="Ancho" value={camara.ancho_int ? `${camara.ancho_int} m` : null} />
              <DimRow label="Alto" value={camara.alto_int ? `${camara.alto_int} m` : null} />
            </>
          )}
        </div>

        {/* BOM totals */}
        {preview && (
          <div style={{ borderTop: "1px solid #e5e5ea", paddingTop: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
              <span style={{ color: "#6e6e73" }}>Ítems BOM</span>
              <span style={{ fontWeight: 600 }}>{preview.totalItems}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
              <span style={{ color: "#6e6e73" }}>Subtotal s/IVA</span>
              <span style={{ fontWeight: 600 }}>{fmtUSD(preview.subtotalUSD)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0", borderTop: "1px solid #e5e5ea", marginTop: 4 }}>
              <span style={{ fontWeight: 700 }}>Total c/IVA (22%)</span>
              <span style={{ fontWeight: 700, color: "#0071e3" }}>{fmtUSD(preview.totalConIVA)}</span>
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div style={{ background: "#fff8e1", border: "1px solid #f59e0b", borderRadius: 8, padding: "8px 10px", marginBottom: 12, fontSize: 12, color: "#78350f" }}>
            {warnings.map((w, i) => (
              <div key={i}>⚠ {w}</div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1, minWidth: 100,
              background: "#0071e3", color: "#fff",
              border: "none", borderRadius: 10, padding: "10px 14px",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => onAdjust?.("Necesito ajustar la cotización. " + (warnings.length ? "Advertencias: " + warnings.join("; ") : "Por favor revisá los datos."))}
            style={{
              flex: 1, minWidth: 100,
              background: "#f5f5f7", color: "#1d1d1f",
              border: "1px solid #e5e5ea", borderRadius: 10, padding: "10px 14px",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >
            Ajustar
          </button>
          <button
            type="button"
            onClick={onDiscard}
            style={{
              background: "transparent", color: "#6e6e73",
              border: "none", borderRadius: 10, padding: "10px 8px",
              fontSize: 13, cursor: "pointer",
            }}
          >
            Descartar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
