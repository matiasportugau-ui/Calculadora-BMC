/**
 * TrustBlock — visual confirmation that the assistant's numbers came from
 * the real cotizador motor (not free text the model invented).
 *
 * Rendered in PanelinChatPanel.jsx whenever the assistant message has a
 * `verifiedQuote` field, populated by the SSE event `verified_quote`
 * which the server emits after an eligible calc tool succeeded.
 *
 * Operator-facing only: the panel runs inside the BMC team app, so it's
 * fine to surface the internal lista name (web/venta) here. The policy
 * "no exposing list names" applies to public channels (ML, Shopify,
 * customer-facing PDFs) — see docs/team/policies/comercial-chat-ml-shopify.md.
 */

import { useState } from "react";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";

const COLOR = {
  ok: "#16a34a",
  okBg: "#f0fdf4",
  okBorder: "#bbf7d0",
  text: "#1d1d1f",
  subtext: "#6e6e73",
  chipBg: "#f3f4f6",
  chipBorder: "#e5e7eb",
};

function fmtUsd(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  return v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n, dec = 1) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("es-UY", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function ListaChip({ lista }) {
  if (!lista) return null;
  const label = lista === "venta" ? "Lista venta" : lista === "web" ? "Lista web" : `Lista ${lista}`;
  return (
    <span
      style={{
        fontSize: 10,
        color: COLOR.subtext,
        background: COLOR.chipBg,
        border: `1px solid ${COLOR.chipBorder}`,
        borderRadius: 6,
        padding: "1px 7px",
        fontFamily: FONT,
      }}
    >
      {label}
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span
      style={{
        fontSize: 11,
        color: COLOR.ok,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: FONT,
      }}
    >
      <span aria-hidden="true">✓</span>
      <span>Verificado por el cotizador</span>
    </span>
  );
}

function SingleSummary({ q }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12, color: COLOR.text, fontFamily: FONT }}>
      <div>
        <strong>USD {fmtUsd(q.total_con_iva)}</strong>{" "}
        <span style={{ color: COLOR.subtext }}>c/IVA {q.iva_pct ?? 22}%</span>
        {Number.isFinite(q.subtotal_sin_iva) && (
          <span style={{ color: COLOR.subtext }}>
            {" · "}USD {fmtUsd(q.subtotal_sin_iva)} sin IVA
          </span>
        )}
      </div>
      {(q.area_m2 != null || q.cant_paneles != null) && (
        <div style={{ color: COLOR.subtext, fontSize: 11 }}>
          {q.area_m2 != null && `${fmtNum(q.area_m2, 2)} m²`}
          {q.area_m2 != null && q.cant_paneles != null && " · "}
          {q.cant_paneles != null && `${q.cant_paneles} paneles`}
        </div>
      )}
    </div>
  );
}

function CompararListasSummary({ q }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12, color: COLOR.text, fontFamily: FONT }}>
      <div>
        Lista web: <strong>USD {fmtUsd(q.web?.total_con_iva)}</strong>
        <span style={{ color: COLOR.subtext }}> c/IVA {q.iva_pct ?? 22}%</span>
      </div>
      <div>
        Lista venta: <strong>USD {fmtUsd(q.venta?.total_con_iva)}</strong>
        <span style={{ color: COLOR.subtext }}> c/IVA {q.iva_pct ?? 22}%</span>
      </div>
      {Number.isFinite(q.delta_usd) && Number.isFinite(q.delta_pct) && (
        <div style={{ color: COLOR.subtext, fontSize: 11 }}>
          Delta: USD {fmtUsd(q.delta_usd)} ({fmtNum(q.delta_pct, 2)}%)
        </div>
      )}
    </div>
  );
}

function CompararEscenariosSummary({ q }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12, color: COLOR.text, fontFamily: FONT }}>
      <div>
        {q.a?.scenario || "A"}: <strong>USD {fmtUsd(q.a?.total_con_iva)}</strong>
      </div>
      <div>
        {q.b?.scenario || "B"}: <strong>USD {fmtUsd(q.b?.total_con_iva)}</strong>
      </div>
      {Number.isFinite(q.delta_usd) && (
        <div style={{ color: COLOR.subtext, fontSize: 11 }}>
          Delta: USD {fmtUsd(q.delta_usd)}
          {Number.isFinite(q.delta_pct) ? ` (${fmtNum(q.delta_pct, 2)}%)` : ""}
        </div>
      )}
    </div>
  );
}

export default function TrustBlock({ verifiedQuote }) {
  const [expanded, setExpanded] = useState(true);
  if (!verifiedQuote) return null;
  const q = verifiedQuote;

  // The lista chip is meaningful for "single" and "comparar_escenarios";
  // "comparar_listas" already shows both lists in its body so the chip
  // would be redundant.
  const showChip = q.kind !== "comparar_listas";

  return (
    <div
      role="status"
      aria-label="Cifras verificadas por el cotizador"
      style={{
        background: COLOR.okBg,
        border: `1px solid ${COLOR.okBorder}`,
        borderRadius: 8,
        padding: "8px 10px",
        marginTop: 4,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontFamily: FONT,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <VerifiedBadge />
        {showChip && <ListaChip lista={q.lista} />}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            color: COLOR.subtext,
            fontSize: 11,
            cursor: "pointer",
            fontFamily: FONT,
          }}
        >
          {expanded ? "Ocultar" : "Ver detalle"}
        </button>
      </div>
      {expanded && (
        <>
          {q.kind === "single" && <SingleSummary q={q} />}
          {q.kind === "comparar_listas" && <CompararListasSummary q={q} />}
          {q.kind === "comparar_escenarios" && <CompararEscenariosSummary q={q} />}
        </>
      )}
    </div>
  );
}
