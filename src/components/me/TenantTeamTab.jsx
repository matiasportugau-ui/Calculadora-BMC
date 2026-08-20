// Tenant BC team tab — Jenerik owner invites seller accounts.
import React, { useEffect, useState } from "react";

export default function TenantTeamTab({ token }) {
  const [state, setState] = useState({ loading: true, tenant: null, members: [], quotes: [], error: null });
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const me = await fetch("/api/me/tenant", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((r) => r.json());
      if (!me.tenant) {
        const admin = await fetch("/api/admin/tenants/bc", {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then((r) => r.json()).catch(() => null);
        if (admin?.ok) {
          const q = await fetch("/api/admin/tenants/bc/quotes?limit=200", {
            credentials: "include",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }).then((r) => r.json()).catch(() => ({ items: [] }));
          setState({
            loading: false,
            tenant: { ...admin.tenant, role: "owner" },
            members: admin.members || [],
            quotes: q.items || [],
            error: null,
          });
          return;
        }
        setState({ loading: false, tenant: null, members: [], quotes: [], error: null });
        return;
      }
      const members = await fetch("/api/me/tenant/members", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then((r) => r.json());
      let quotes = [];
      if (me.tenant?.role === "owner") {
        const q = await fetch("/api/me/tenant/quotes?limit=200", {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).then((r) => r.json());
        quotes = q.items || [];
      }
      setState({
        loading: false,
        tenant: me.tenant,
        members: members.items || [],
        quotes,
        error: members.ok === false ? members.error : null,
      });
    } catch (e) {
      setState({ loading: false, tenant: null, members: [], error: e.message });
    }
  }

  useEffect(() => { load(); }, [token]);

  async function invite(ev) {
    ev.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/me/tenant/members", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email, role: "user" }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || `http_${r.status}`);
      setEmail("");
      await load();
    } catch (e) {
      setState((s) => ({ ...s, error: e.message }));
    } finally {
      setBusy(false);
    }
  }

  if (state.loading) return <p style={{ color: "#64748b" }}>Cargando equipo…</p>;
  if (!state.tenant) {
    return (
      <p style={{ color: "#64748b", fontSize: 13 }}>
        Esta cuenta no está en el tenant BC. Pedile a BMC que te invite como owner.
      </p>
    );
  }

  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#475569" }}>
        {state.tenant.display_name} · rol <strong>{state.tenant.role}</strong>
        {" · "}PDF con precios de venta. Comisión y costo fábrica: <strong>apagados</strong>.
      </p>
      {state.error ? <p style={{ color: "#b91c1c", fontSize: 13 }}>{state.error}</p> : null}
      {state.tenant.role === "owner" ? (
        <form onSubmit={invite} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vendedor@empresa.com"
            style={{ flex: 1, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8 }}
          />
          <button type="submit" disabled={busy} style={{
            padding: "8px 14px", border: 0, borderRadius: 8, background: "#0f172a", color: "#fff", fontWeight: 600,
          }}>
            Invitar
          </button>
        </form>
      ) : null}
      <div style={{ display: "grid", gap: 10 }}>
        {state.members.map((m) => {
          const theirs = state.quotes.filter((q) =>
            (m.user_id && q.user_id === m.user_id) ||
            (q.user_email && q.user_email.toLowerCase() === m.invited_email),
          );
          return (
            <div key={m.invited_email} style={{ padding: 12, border: "1px solid #e2e8f0", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.invited_email}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {m.name || "pendiente de Google login"} · {m.claimed_at ? "activo" : "invitado"} · {theirs.length} presupuesto(s)
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#334155" }}>{m.role}</div>
              </div>
              {theirs.length ? (
                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                  {theirs.map((q) => (
                    <a
                      key={q.quote_id}
                      href={`/?quote=${encodeURIComponent(q.quote_id)}`}
                      style={{ fontSize: 12, color: "#1d4ed8", textDecoration: "none" }}
                    >
                      {q.code || q.quote_id.slice(0, 8)} · {q.cliente || "Sin cliente"} · {q.total_usd != null ? `USD ${Number(q.total_usd).toFixed(2)}` : "—"}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
