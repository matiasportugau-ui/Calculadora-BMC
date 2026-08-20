// BMC-only: full tenant agent transcripts + token/$ estimates (eval).
import { useCallback, useEffect, useState } from "react";
import { downloadBlob, moneyUsdEstimate, tenantAdminFetch, whenUy } from "./tenantAdminApi.js";

export default function TenantAgentEvalPanel({ slug, token }) {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const s = await tenantAdminFetch(`/api/admin/tenants/${slug}/ai-stats?days=${days}`, { token });
    const l = await tenantAdminFetch(`/api/admin/tenants/${slug}/conversations?days=${days}&limit=80`, { token });
    setStats(s.stats || s);
    setItems(l.items || []);
  }, [slug, token, days]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function openConv(id) {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const j = await tenantAdminFetch(`/api/admin/tenants/${slug}/conversations/${id}`, { token });
      setOpenId(id);
      setDetail(j.conversation);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportConv(format) {
    setBusy(true);
    setError(null);
    try {
      if (format === "csv") {
        const r = await fetch(
          `/api/admin/tenants/${slug}/export?format=conversations-csv&limit=200`,
          { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (!r.ok) throw new Error(`http_${r.status}`);
        downloadBlob(`${slug}-conversations.csv`, await r.text(), "text/csv");
      } else {
        const j = await tenantAdminFetch(`/api/admin/tenants/${slug}/export?limit=200`, { token });
        downloadBlob(
          `${slug}-ia-eval.json`,
          JSON.stringify({ ai_stats: j.ai_stats, conversations: j.conversations }, null, 2),
          "application/json",
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const st = stats || {};

  return (
    <section>
      <p style={{ color: "var(--ac-text-2)", fontSize: 13, maxWidth: 720 }}>
        Transcripciones completas de {st.agent_name || "el agente"} para análisis de eval.
        Tokens y USD son <strong>estimación</strong>, no factura del proveedor.
        Los vendedores del tenant no ven esta pestaña.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: days === d ? "0" : "1px solid var(--ac-border)",
              background: days === d ? "var(--ac-accent)" : "var(--ac-surface)",
              color: days === d ? "#fff" : "var(--ac-text)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {d}d
          </button>
        ))}
        <button type="button" disabled={busy} onClick={() => exportConv("json")}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--ac-border)", background: "var(--ac-surface)", fontWeight: 600 }}>
          Extraer JSON
        </button>
        <button type="button" disabled={busy} onClick={() => exportConv("csv")}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--ac-border)", background: "var(--ac-surface)", fontWeight: 600 }}>
          Extraer CSV
        </button>
      </div>

      {error ? <p style={{ color: "var(--ac-error)" }}>{error}</p> : null}

      <section className="adminCot__stats" aria-label="Tokens y costo estimado">
        <div className="adminCot__stat">
          <span className="adminCot__stat-label">Conversaciones</span>
          <span className="adminCot__stat-value">{st.conversations ?? 0}</span>
        </div>
        <div className="adminCot__stat">
          <span className="adminCot__stat-label">Turnos</span>
          <span className="adminCot__stat-value">{st.turns ?? 0}</span>
        </div>
        <div className="adminCot__stat">
          <span className="adminCot__stat-label">Tokens</span>
          <span className="adminCot__stat-value">{st.tokens ?? 0}</span>
        </div>
        <div className="adminCot__stat">
          <span className="adminCot__stat-label">USD estimado</span>
          <span className="adminCot__stat-value">{moneyUsdEstimate(st.estimated_cost_usd)}</span>
        </div>
      </section>

      <div style={{ display: "grid", gap: 8 }}>
        {items.map((c) => {
          const tokens = Number(c.input_tokens || 0) + Number(c.output_tokens || 0);
          const open = openId === c.conversation_id;
          return (
            <article key={c.conversation_id} className="adminCot__card">
              <button
                type="button"
                onClick={() => openConv(c.conversation_id)}
                style={{
                  width: "100%", textAlign: "left", background: "transparent",
                  border: 0, cursor: "pointer", color: "inherit", padding: 0,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {c.agent_name} · {c.user_email || "anónimo"} · {c.turn_count} turnos
                </div>
                <div style={{ fontSize: 12, color: "var(--ac-text-2)" }}>
                  {whenUy(c.last_at)} · {tokens} tok · {moneyUsdEstimate(c.estimated_cost_usd)}
                  {c.last_user_preview ? ` · “${c.last_user_preview}”` : ""}
                </div>
              </button>
              {open && detail ? (
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {(detail.turns || []).map((t) => (
                    <div
                      key={`${t.turn_id}-${t.turn_index}`}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: t.role === "user" ? "var(--ac-wash, #f4f4f5)" : "var(--ac-surface)",
                        border: "1px solid var(--ac-border)",
                        fontSize: 13,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: "var(--ac-text-2)" }}>
                        {t.role === "user" ? "Usuario" : detail.agent_name || "Agente"}
                        {t.input_tokens || t.output_tokens
                          ? ` · ${Number(t.input_tokens || 0) + Number(t.output_tokens || 0)} tok · ${moneyUsdEstimate(t.estimated_cost_usd)}`
                          : ""}
                      </div>
                      {t.content || "—"}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
        {!items.length ? (
          <p style={{ color: "var(--ac-text-2)" }}>Todavía no hay conversaciones de este tenant.</p>
        ) : null}
      </div>
    </section>
  );
}
