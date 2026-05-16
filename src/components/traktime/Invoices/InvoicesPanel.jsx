import { useEffect, useMemo, useState } from "react";
import { tkApi } from "../shared/api.js";
import { button, card, colors, input } from "../shared/styles.js";

function fmtMoney(n) {
  return `USD ${Number(n || 0).toFixed(2)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function Builder({ clients, onIssued }) {
  const [clientId, setClientId] = useState("");
  const [from, setFrom] = useState(startOfMonthIso());
  const [to, setTo] = useState(todayIso());
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadPreview() {
    if (!clientId) return;
    setBusy(true);
    setError("");
    try {
      const r = await tkApi.reportBillable({ client_id: clientId, from, to });
      setPreview(r);
    } catch (e) {
      setError(e.message || "preview_failed");
    } finally {
      setBusy(false);
    }
  }

  async function createDraftAndIssue() {
    if (!clientId) return;
    setBusy(true);
    setError("");
    try {
      const d = await tkApi.draftInvoice({
        client_id: clientId,
        period_from: new Date(from).toISOString(),
        period_to: new Date(`${to}T23:59:59Z`).toISOString(),
      });
      await tkApi.issueInvoice(d.invoice.invoice_id);
      setPreview(null);
      onIssued?.();
    } catch (e) {
      setError(e.message || "issue_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontWeight: 600 }}>Nueva factura</div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto auto", gap: 8 }}>
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={input}>
          <option value="">Cliente…</option>
          {clients.map((c) => (
            <option key={c.client_id} value={c.client_id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={input} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={input} />
        <button disabled={busy || !clientId} onClick={loadPreview} style={button("ghost")}>
          Previsualizar
        </button>
        <button
          disabled={busy || !preview || !preview.groups?.length}
          onClick={createDraftAndIssue}
          style={button("primary")}
        >
          Emitir
        </button>
      </div>
      {error ? <div style={{ color: colors.danger, fontSize: 13 }}>{error}</div> : null}
      {preview ? (
        <div style={{ marginTop: 8 }}>
          {preview.groups?.length === 0 ? (
            <div style={{ color: colors.textMuted, fontSize: 13 }}>
              Sin horas facturables en el período.
            </div>
          ) : (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: colors.textMuted, textAlign: "left" }}>
                  <th>Proyecto</th>
                  <th>Horas (redondeadas)</th>
                  <th>USD/h</th>
                  <th style={{ textAlign: "right" }}>Importe</th>
                </tr>
              </thead>
              <tbody>
                {preview.groups.map((g) => (
                  <tr key={g.project_id}>
                    <td>{g.project_name}</td>
                    <td>
                      {g.rounded_hours.toFixed(2)}h <span style={{ color: colors.textMuted }}>({g.rounding_minutes}m)</span>
                    </td>
                    <td>${g.hourly_rate_usd.toFixed(2)}</td>
                    <td style={{ textAlign: "right" }}>{fmtMoney(g.amount_usd)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: `1px solid ${colors.border}` }}>
                  <td colSpan={3}>Subtotal (sin IVA)</td>
                  <td style={{ textAlign: "right" }}>{fmtMoney(preview.subtotal_usd)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }) {
  const bg =
    status === "paid"
      ? "#d4edda"
      : status === "issued"
      ? "#cce5ff"
      : status === "void"
      ? "#f4cdcd"
      : "#e5e5ea";
  const fg =
    status === "paid"
      ? "#155724"
      : status === "issued"
      ? "#004085"
      : status === "void"
      ? "#721c24"
      : "#6e6e73";
  return (
    <span
      style={{
        background: bg,
        color: fg,
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.04,
      }}
    >
      {status}
    </span>
  );
}

export default function InvoicesPanel() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  async function loadAll() {
    try {
      const [inv, cl] = await Promise.all([tkApi.listInvoices(), tkApi.listClients()]);
      setInvoices(inv.invoices || []);
      setClients(cl.clients || []);
      setError("");
    } catch (e) {
      setError(e.message || "load_failed");
    }
  }
  useEffect(() => {
    loadAll();
  }, []);

  const filtered = useMemo(
    () => (filter ? invoices.filter((i) => i.status === filter) : invoices),
    [invoices, filter],
  );

  async function togglePaid(i) {
    try {
      await tkApi.markPaidInvoice(i.invoice_id, i.status !== "paid");
      await loadAll();
    } catch (e) {
      setError(e.message || "toggle_failed");
    }
  }

  async function voidInv(i) {
    if (!window.confirm(`Anular factura ${i.number || "(draft)"}?`)) return;
    try {
      await tkApi.voidInvoice(i.invoice_id);
      await loadAll();
    } catch (e) {
      setError(e.message || "void_failed");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <div style={{ color: colors.danger }}>{error}</div> : null}

      <Builder clients={clients} onIssued={loadAll} />

      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 600 }}>Facturas</div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={input}>
            <option value="">Todos los estados</option>
            <option value="draft">draft</option>
            <option value="issued">issued</option>
            <option value="paid">paid</option>
            <option value="void">void</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div style={{ color: colors.textMuted, padding: 16, textAlign: "center" }}>
            Sin facturas todavía.
          </div>
        ) : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: colors.textMuted, textAlign: "left" }}>
                <th>#</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.invoice_id} style={{ borderTop: `1px solid ${colors.border}` }}>
                  <td style={{ fontFamily: "monospace" }}>{i.number || "(draft)"}</td>
                  <td>{i.client_name}</td>
                  <td>{i.issue_date || "—"}</td>
                  <td>
                    <StatusPill status={i.status} />
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmtMoney(i.total_usd)}
                  </td>
                  <td style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    {i.pdf_url ? (
                      <a
                        href={i.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ ...button("ghost"), padding: "4px 10px", textDecoration: "none" }}
                      >
                        PDF
                      </a>
                    ) : null}
                    {i.status === "issued" || i.status === "paid" ? (
                      <button onClick={() => togglePaid(i)} style={{ ...button("ghost"), padding: "4px 10px" }}>
                        {i.status === "paid" ? "Marcar pendiente" : "Marcar pagada"}
                      </button>
                    ) : null}
                    {i.status !== "void" ? (
                      <button onClick={() => voidInv(i)} style={{ ...button("ghost"), padding: "4px 10px" }}>
                        Anular
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
