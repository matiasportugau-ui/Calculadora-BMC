import { useState } from "react";
import { Clock, Trash2, Download, X, Copy } from "lucide-react";
import { C, FONT, TR, TN } from "../data/constants.js";
import { fmtPrice } from "../utils/helpers.js";

const SCENARIO_LABELS = {
  solo_techo: "Techo",
  solo_fachada: "Fachada",
  techo_fachada: "Techo + Fachada",
  camara_frig: "Cámara Frig.",
};

function QuoteCard({ quote, onLoad, onDelete, onCompare, isCompareSource }) {
  const date = new Date(quote.timestamp);
  const dateStr = date.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "2-digit" });
  const timeStr = date.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{
      background: isCompareSource ? C.primarySoft : C.surface,
      border: `1.5px solid ${isCompareSource ? C.primary : C.border}`,
      borderRadius: 12, padding: 14, marginBottom: 10,
      transition: TR,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.tp }}>
            {quote.proyecto?.nombre || "Sin nombre"}
          </div>
          <div style={{ fontSize: 11, color: C.ts, marginTop: 2 }}>
            {dateStr} {timeStr} · {SCENARIO_LABELS[quote.scenario] || quote.scenario}
          </div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, color: "#fff",
          background: C.brand, borderRadius: 6, padding: "2px 8px",
        }}>
          {quote.panelLabel} {quote.espesor}mm
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.brand, ...TN }}>
          USD {fmtPrice(quote.grandTotal?.totalFinal || 0)}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onCompare(quote)} title="Comparar"
            style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", padding: "4px 6px", display: "flex", alignItems: "center", color: C.ts }}>
            <Copy size={14} />
          </button>
          <button onClick={() => onLoad(quote)} title="Cargar cotización"
            style={{ background: C.primary, border: "none", borderRadius: 6, cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", gap: 4, color: "#fff", fontSize: 12, fontWeight: 500 }}>
            <Download size={12} /> Cargar
          </button>
          <button onClick={() => onDelete(quote.id)} title="Eliminar"
            style={{ background: "none", border: `1px solid ${C.dangerSoft}`, borderRadius: 6, cursor: "pointer", padding: "4px 6px", display: "flex", alignItems: "center", color: C.danger }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {quote.proyecto?.descripcion && (
        <div style={{ fontSize: 11, color: C.ts, marginTop: 6 }}>
          {quote.proyecto.descripcion} · {quote.proyecto.direccion || "—"}
        </div>
      )}
    </div>
  );
}

function CompareView({ quoteA, quoteB, onClose }) {
  if (!quoteA || !quoteB) return null;

  const rows = [
    { label: "Cliente", a: quoteA.proyecto?.nombre, b: quoteB.proyecto?.nombre },
    { label: "Escenario", a: SCENARIO_LABELS[quoteA.scenario], b: SCENARIO_LABELS[quoteB.scenario] },
    { label: "Panel", a: `${quoteA.panelLabel} ${quoteA.espesor}mm`, b: `${quoteB.panelLabel} ${quoteB.espesor}mm` },
    { label: "Color", a: quoteA.color, b: quoteB.color },
    { label: "Subtotal s/IVA", a: `$${fmtPrice(quoteA.grandTotal?.subtotalSinIVA || 0)}`, b: `$${fmtPrice(quoteB.grandTotal?.subtotalSinIVA || 0)}`, isMoney: true },
    { label: "IVA 22%", a: `$${fmtPrice(quoteA.grandTotal?.iva || 0)}`, b: `$${fmtPrice(quoteB.grandTotal?.iva || 0)}`, isMoney: true },
    { label: "TOTAL", a: `$${fmtPrice(quoteA.grandTotal?.totalFinal || 0)}`, b: `$${fmtPrice(quoteB.grandTotal?.totalFinal || 0)}`, isMoney: true, bold: true },
  ];

  const diff = (quoteA.grandTotal?.totalFinal || 0) - (quoteB.grandTotal?.totalFinal || 0);

  return (
    <div style={{ background: C.surface, borderRadius: 12, border: `1.5px solid ${C.primary}`, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: C.primarySoft }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.primary }}>Comparar cotizaciones</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.ts }}><X size={16} /></button>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 0 }}>
          <div style={{ padding: "6px 8px", fontSize: 11, fontWeight: 600, color: C.ts }}></div>
          <div style={{ padding: "6px 8px", fontSize: 12, fontWeight: 600, color: C.primary, textAlign: "center", background: C.primarySoft, borderRadius: "6px 0 0 0" }}>
            Cotización A
          </div>
          <div style={{ padding: "6px 8px", fontSize: 12, fontWeight: 600, color: C.brand, textAlign: "center", background: C.brandLight, borderRadius: "0 6px 0 0" }}>
            Cotización B
          </div>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "contents" }}>
              <div style={{ padding: "6px 8px", fontSize: 12, fontWeight: 600, color: C.ts, borderTop: `1px solid ${C.border}` }}>{r.label}</div>
              <div style={{
                padding: "6px 8px", fontSize: r.bold ? 14 : 12,
                fontWeight: r.bold ? 700 : 400, color: C.tp,
                textAlign: r.isMoney ? "right" : "center",
                borderTop: `1px solid ${C.border}`, ...TN,
                background: r.a !== r.b ? C.warningSoft : "transparent",
              }}>{r.a}</div>
              <div style={{
                padding: "6px 8px", fontSize: r.bold ? 14 : 12,
                fontWeight: r.bold ? 700 : 400, color: C.tp,
                textAlign: r.isMoney ? "right" : "center",
                borderTop: `1px solid ${C.border}`, ...TN,
                background: r.a !== r.b ? C.warningSoft : "transparent",
              }}>{r.b}</div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 12, textAlign: "center", fontSize: 13, fontWeight: 600,
          color: diff > 0 ? C.danger : diff < 0 ? C.success : C.ts,
          padding: "8px 12px", borderRadius: 8, background: C.surfaceAlt,
        }}>
          {diff === 0
            ? "Mismo total"
            : `Diferencia: USD ${fmtPrice(Math.abs(diff))} ${diff > 0 ? "(A es más cara)" : "(B es más cara)"}`}
        </div>
      </div>
    </div>
  );
}

export default function QuotationHistory({ savedQuotes, onLoad, onDelete, onClose }) {
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);

  const handleCompare = (quote) => {
    if (!compareA) { setCompareA(quote); return; }
    if (compareA.id === quote.id) { setCompareA(null); return; }
    setCompareB(quote);
  };

  const clearCompare = () => { setCompareA(null); setCompareB(null); };

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 420, maxWidth: "100vw",
      background: C.bg, boxShadow: "-4px 0 32px rgba(0,0,0,0.15)",
      zIndex: 100, fontFamily: FONT, display: "flex", flexDirection: "column",
      animation: "bmc-fade 150ms ease-in-out",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 16, color: C.tp }}>
          <Clock size={18} color={C.primary} /> Historial
          <span style={{ fontSize: 12, fontWeight: 500, color: C.ts }}>({savedQuotes.length})</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.ts, padding: 4 }}><X size={20} /></button>
      </div>

      {compareA && !compareB && (
        <div style={{ padding: "10px 20px", background: C.warningSoft, fontSize: 12, color: "#8A6200", fontWeight: 500 }}>
          Seleccioná una segunda cotización para comparar
          <button onClick={clearCompare} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: C.danger, fontSize: 12, textDecoration: "underline" }}>Cancelar</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {compareA && compareB && (
          <div style={{ marginBottom: 16 }}>
            <CompareView quoteA={compareA} quoteB={compareB} onClose={clearCompare} />
          </div>
        )}

        {savedQuotes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.tp }}>Sin cotizaciones guardadas</div>
            <div style={{ fontSize: 12, color: C.ts, marginTop: 4 }}>Las cotizaciones guardadas aparecerán aquí</div>
          </div>
        ) : (
          savedQuotes.map(q => (
            <QuoteCard
              key={q.id}
              quote={q}
              onLoad={onLoad}
              onDelete={onDelete}
              onCompare={handleCompare}
              isCompareSource={compareA?.id === q.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
