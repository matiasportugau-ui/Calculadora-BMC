import { useEffect } from "react";
import { ALL_MODULES, ALL_ROLES, ALL_LEVELS } from "../../../hooks/useUserAdmin.js";

export default function UserDetailDrawer({
  open, detail, loading, onClose,
  currentUserId, currentRole,
  onAddRole, onRemoveRole, onSetModuleGrant,
  onSuspend, onReactivate, onRevokeSessions,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)",
          backdropFilter: "blur(2px)", zIndex: 80,
        }}
      />
      <aside
        role="dialog"
        aria-labelledby="user-drawer-title"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 560, maxWidth: "100vw",
          background: "var(--ac-surface)", boxShadow: "var(--ac-shadow-2)", zIndex: 81,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <header style={{
          padding: "14px 18px", borderBottom: "1px solid var(--ac-border)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <h2 id="user-drawer-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ac-text)", flex: 1 }}>
            Detalle de usuario
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="adminCot__btn adminCot__btn--ghost adminCot__btn--sm"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {loading || !detail ? (
            <p style={{ color: "var(--ac-text-2)" }}>Cargando…</p>
          ) : (
            <DetailBody
              detail={detail}
              currentUserId={currentUserId}
              currentRole={currentRole}
              onAddRole={onAddRole}
              onRemoveRole={onRemoveRole}
              onSetModuleGrant={onSetModuleGrant}
              onSuspend={onSuspend}
              onReactivate={onReactivate}
              onRevokeSessions={onRevokeSessions}
            />
          )}
        </div>
      </aside>
    </>
  );
}

function DetailBody({
  detail, currentUserId, currentRole,
  onAddRole, onRemoveRole, onSetModuleGrant,
  onSuspend, onReactivate, onRevokeSessions,
}) {
  const { user, roles, module_grants, sessions, recent_audit } = detail;
  const isSelf = user.user_id === currentUserId;
  const targetIsSuperadmin = roles.some((r) => r.role === "superadmin");
  const canDemoteTarget = !isSelf && (currentRole === "superadmin" || !targetIsSuperadmin);
  const userRoles = new Set(roles.map((r) => r.role));
  const grantsByModule = Object.fromEntries(module_grants.map((g) => [g.module, g.level]));

  return (
    <>
      <Section title="Identidad">
        <p style={meta}>{user.email}</p>
        <p style={{ ...meta, fontSize: 12 }}>id: <code>{user.user_id}</code></p>
        <p style={meta}>
          Plan: <strong>{user.plan_tier}</strong> · Estado: <strong>{user.status}</strong>
          {user.mfa_required ? " · MFA requerido" : ""}
        </p>
      </Section>

      <Section title="Roles">
        {isSelf ? (
          <p style={muted}>No podés modificar tus propios roles desde acá.</p>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ALL_ROLES.map((role) => {
            const has = userRoles.has(role);
            const blockedByLevel = role === "superadmin" && currentRole !== "superadmin";
            const disabled = isSelf || blockedByLevel || (has && !canDemoteTarget);
            return (
              <button
                key={role}
                type="button"
                disabled={disabled}
                onClick={() => has ? onRemoveRole(user.user_id, role) : onAddRole(user.user_id, role)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--ac-radius-sm)",
                  border: has ? "none" : "1px solid var(--ac-border)",
                  background: has ? "var(--ac-accent)" : "var(--ac-surface)",
                  color: has ? "var(--ac-accent-fg)" : "var(--ac-text)",
                  fontSize: 13,
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                  fontFamily: "var(--ac-font)",
                }}
              >
                {has ? "✓ " : ""}{role}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Permisos por módulo">
        <p style={{ ...muted, fontSize: 12, marginBottom: 8 }}>
          Sólo se listan grants explícitos. Si un módulo no aparece, el usuario hereda el nivel por defecto de su rol.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 8 }}>
          {ALL_MODULES.map((m) => (
            <div key={m} style={{ display: "contents" }}>
              <div style={{ alignSelf: "center", color: "var(--ac-text)", fontSize: 13 }}>{m}</div>
              <select
                value={grantsByModule[m] || "none"}
                onChange={(e) => onSetModuleGrant(user.user_id, m, e.target.value)}
                disabled={isSelf}
                style={{
                  padding: "6px 10px",
                  borderRadius: "var(--ac-radius-sm)",
                  border: "1px solid var(--ac-border)",
                  background: "var(--ac-surface)",
                  color: "var(--ac-text)",
                  fontSize: 13,
                  fontFamily: "var(--ac-font)",
                }}
              >
                {ALL_LEVELS.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Acciones">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {user.status === "suspended" ? (
            <button
              type="button"
              onClick={() => onReactivate(user.user_id)}
              className="adminCot__btn adminCot__btn--sm"
              disabled={isSelf}
            >
              Reactivar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const reason = window.prompt("Motivo de suspensión (opcional):") || "";
                onSuspend(user.user_id, reason);
              }}
              className="adminCot__btn adminCot__btn--sm"
              style={{ background: "var(--ac-warn)", color: "#fff" }}
              disabled={isSelf || (targetIsSuperadmin && currentRole !== "superadmin")}
            >
              Suspender
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Revocar TODAS las sesiones activas de este usuario? Tendrá que iniciar sesión de nuevo.")) {
                onRevokeSessions(user.user_id);
              }
            }}
            className="adminCot__btn adminCot__btn--sm"
            disabled={isSelf}
          >
            Revocar sesiones
          </button>
        </div>
      </Section>

      <Section title={`Sesiones recientes (${sessions.length})`}>
        {sessions.length === 0 ? (
          <p style={muted}>Sin sesiones registradas.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {sessions.map((s) => (
              <li key={s.session_id} style={{ padding: "6px 0", borderBottom: "1px solid var(--ac-border-2)", fontSize: 12, color: "var(--ac-text-2)" }}>
                <div>{new Date(s.created_at).toLocaleString()}</div>
                <div>{s.ip || "—"} · {(s.user_agent || "").slice(0, 60)}</div>
                {s.revoked_at ? <div style={{ color: "var(--ac-error)" }}>revocada {new Date(s.revoked_at).toLocaleString()}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Audit log (${recent_audit.length})`}>
        {recent_audit.length === 0 ? (
          <p style={muted}>Sin eventos recientes.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {recent_audit.map((a) => (
              <li key={a.audit_id} style={{ padding: "6px 0", borderBottom: "1px solid var(--ac-border-2)", fontSize: 12 }}>
                <span style={{ color: "var(--ac-text)" }}>{a.action}</span>{" "}
                <span style={{ color: "var(--ac-text-2)" }}>· {new Date(a.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "var(--ac-text-2)", textTransform: "uppercase", letterSpacing: 0.6 }}>
        {title}
      </h3>
      {children}
    </section>
  );
}
const meta = { margin: "4px 0", color: "var(--ac-text)", fontSize: 13 };
const muted = { margin: "4px 0", color: "var(--ac-text-2)", fontSize: 13 };
