function RolePill({ role }) {
  const COLORS = {
    superadmin: ["#fee2e2", "#991b1b"],
    admin: ["#fef3c7", "#92400e"],
    operator: ["#dbeafe", "#1e40af"],
    comprador: ["#e5e7eb", "#374151"],
  };
  const [bg, fg] = COLORS[role] || ["#f0f0f2", "#6e6e73"];
  return (
    <span className="adminCot__pill" style={{ background: bg, color: fg, marginRight: 4 }}>
      {role}
    </span>
  );
}

function StatusBadge({ status }) {
  const VAR = { active: "success", suspended: "warn", deleted: "error" };
  return (
    <span className={`adminCot__pill adminCot__pill--${VAR[status] || "muted"}`}>
      {status || "—"}
    </span>
  );
}

function timeAgo(iso) {
  if (!iso) return "nunca";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "ahora";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3600_000)}h`;
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString();
}

export default function UsersTable({ items, selectedId, onSelect, loading, error, onLoadMore, nextCursor }) {
  if (error) {
    return (
      <div style={{ padding: 24, color: "var(--ac-error)", background: "var(--ac-surface)", borderRadius: "var(--ac-radius)", border: "1px solid var(--ac-border)" }}>
        Error: {error}
      </div>
    );
  }
  if (!items.length && loading) {
    return <div style={{ padding: 24, color: "var(--ac-text-2)" }}>Cargando usuarios…</div>;
  }
  if (!items.length) {
    return <div style={{ padding: 24, color: "var(--ac-text-2)" }}>Sin resultados.</div>;
  }
  return (
    <div style={{ background: "var(--ac-surface)", borderRadius: "var(--ac-radius)", border: "1px solid var(--ac-border)", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--ac-surface-2)", borderBottom: "1px solid var(--ac-border)" }}>
              <Th>Usuario</Th>
              <Th>Roles</Th>
              <Th>Grants</Th>
              <Th>Estado</Th>
              <Th>Último login</Th>
              <Th>Última actividad</Th>
              <Th>Registrado</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => {
              const isSel = u.user_id === selectedId;
              return (
                <tr
                  key={u.user_id}
                  onClick={() => onSelect(u.user_id)}
                  style={{
                    cursor: "pointer",
                    background: isSel ? "var(--ac-surface-2)" : undefined,
                    borderBottom: "1px solid var(--ac-border-2)",
                  }}
                >
                  <Td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar user={u} />
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--ac-text)" }}>{u.name || "—"}</div>
                        <div style={{ fontSize: 12, color: "var(--ac-text-2)" }}>{u.email}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>{(u.roles || []).map((r) => <RolePill key={r} role={r} />)}</Td>
                  <Td><span style={{ color: "var(--ac-text-2)" }}>{u.module_grant_count || 0}</span></Td>
                  <Td><StatusBadge status={u.status} /></Td>
                  <Td><span style={{ color: "var(--ac-text-2)" }}>{timeAgo(u.last_login_at)}</span></Td>
                  <Td><span style={{ color: "var(--ac-text-2)" }}>{timeAgo(u.last_active_at)}</span></Td>
                  <Td><span style={{ color: "var(--ac-text-2)" }}>{new Date(u.created_at).toLocaleDateString()}</span></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {nextCursor ? (
        <div style={{ padding: 12, textAlign: "center", borderTop: "1px solid var(--ac-border)" }}>
          <button
            type="button"
            className="adminCot__btn adminCot__btn--ghost adminCot__btn--sm"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? "Cargando…" : "Cargar más"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Th({ children }) {
  return <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, fontSize: 12, color: "var(--ac-text-2)", textTransform: "uppercase", letterSpacing: 0.5 }}>{children}</th>;
}
function Td({ children }) {
  return <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>{children}</td>;
}

function Avatar({ user }) {
  if (user.picture_url) {
    return <img src={user.picture_url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />;
  }
  const initials = (user.name || user.email || "?").split(/[\s@]/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("");
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%", background: "var(--ac-accent)",
      color: "var(--ac-accent-fg)", display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 600, fontSize: 12,
    }}>{initials || "?"}</div>
  );
}
