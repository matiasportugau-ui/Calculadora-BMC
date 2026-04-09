// ═══════════════════════════════════════════════════════════════════════════
// Presentación PDF — benchmark licitación (helpers.generateBidPresentationHTML)
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useEffect } from "react";
import { ArrowLeft, FileDown, Printer, Presentation } from "lucide-react";
import { C, FONT, SHC } from "../data/constants.js";
import {
  generateBidPresentationHTML,
  createPreviewUrl,
  revokePreviewUrl,
} from "../utils/helpers.js";
import { downloadPdf } from "../utils/pdfGenerator.js";

export default function BidPresentation({ onBack: onBackProp }) {
  const onBack = onBackProp || (() => window.history.back());
  const html = useMemo(() => generateBidPresentationHTML(), []);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handlePdf = useCallback(async () => {
    setBusy(true);
    try {
      await downloadPdf(html, `Presentación benchmark licitación — BMC.pdf`);
    } finally {
      setBusy(false);
    }
  }, [html]);

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: "100vh" }}>
      <div
        style={{
          background: C.brand,
          color: "#fff",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.35)",
              background: "transparent",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
            }}
          >
            <ArrowLeft size={16} />
            Volver
          </button>
          <Presentation size={20} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.5px" }}>
              Presentación — Benchmark licitación
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>PDF multipágina · ISODEC PIR 50 mm vs referencia</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.35)",
              background: "transparent",
              color: "#fff",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Printer size={14} />
            Vista previa
          </button>
          <button
            type="button"
            onClick={handlePdf}
            disabled={busy}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: C.primary,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FileDown size={14} />
            {busy ? "Generando…" : "Descargar PDF"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            borderRadius: 16,
            border: `1.5px solid ${C.border}`,
            padding: 20,
            background: C.surface,
            boxShadow: SHC,
            fontSize: 14,
            color: C.ts,
            lineHeight: 1.55,
          }}
        >
          <p style={{ marginTop: 0 }}>
            El PDF incluye: portada, tabla del competidor de referencia, comparación con <b>ISODEC PIR 50 mm</b> (lista venta),
            estrategia de competencia, benchmarks de mercado y descargo. Podés abrir vista previa o descargar el archivo.
          </p>
          <p style={{ marginBottom: 0, fontSize: 13, color: C.tt }}>
            Hash directo: <code style={{ fontSize: 12 }}>#presentacion-licitacion</code>
          </p>
        </div>
      </div>

      {previewOpen && (
        <PreviewModal html={html} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

function PreviewModal({ html, onClose }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const u = createPreviewUrl(html);
    setUrl(u);
    return () => revokePreviewUrl(u);
  }, [html]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!url) return null;

  return (
    <div
      role="presentation"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          background: C.dark,
          color: "#fff",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700 }}>Vista previa — Presentación</span>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.3)",
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Cerrar
        </button>
      </div>
      <div style={{ flex: 1, padding: 16, overflow: "auto", display: "flex", justifyContent: "center" }}>
        <iframe
          title="Presentación benchmark"
          src={url}
          style={{
            width: "210mm",
            maxWidth: "100%",
            minHeight: "80vh",
            border: "none",
            borderRadius: 8,
            background: "#fff",
            boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
          }}
        />
      </div>
    </div>
  );
}
