// ═══════════════════════════════════════════════════════════════════════════
// src/components/admin/users/UserAdminModule.jsx — /hub/admin/users entry.
// ───────────────────────────────────────────────────────────────────────────
// Composes the user-admin sub-components using the existing .adminCot
// design system (skin tokens from admin-cotizaciones/styles.css). The
// SkinProvider wrapper provides theme context for the ⌘K palette to live
// alongside the existing admin-cotizaciones skin store (shared localStorage).
//
// Route is gated by <RequireGrant role="admin"> in App.jsx, so we don't
// double-check role here.
// ═══════════════════════════════════════════════════════════════════════════

import { Link } from "react-router-dom";
import { SkinProvider, useSkin } from "../../admin-cotizaciones/SkinProvider.jsx";
import "../../admin-cotizaciones/styles.css";
import { useUserAdmin } from "../../../hooks/useUserAdmin.js";
import UserStatStrip from "./UserStatStrip.jsx";
import UserToolbar from "./UserToolbar.jsx";
import UsersTable from "./UsersTable.jsx";
import UserDetailDrawer from "./UserDetailDrawer.jsx";

function ModuleInner() {
  const { skin } = useSkin();
  const ua = useUserAdmin();

  return (
    <div className="adminCot" data-skin={skin}>
      <header className="adminCot__topbar" role="banner">
        <nav className="adminCot__crumb" aria-label="Breadcrumb">
          <span>BMC</span>
          <span className="adminCot__crumb-sep">›</span>
          <Link to="/hub">hub</Link>
          <span className="adminCot__crumb-sep">›</span>
          <Link to="/hub/admin">admin</Link>
          <span className="adminCot__crumb-sep">›</span>
          <span style={{ color: "var(--ac-text)" }}>usuarios</span>
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <span className="adminCot__live" aria-live="polite">
            <span className="adminCot__live-dot" data-state={ua.loading ? "busy" : "ok"} />
            {ua.loading ? "Cargando…" : "En vivo"}
          </span>
        </div>
      </header>

      <main style={{ padding: 16, maxWidth: 1280, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <h1 style={{ margin: "8px 0 12px", fontSize: 22, fontWeight: 700, color: "var(--ac-text)" }}>
          Usuarios
        </h1>

        <UserStatStrip stats={ua.stats} />

        <UserToolbar
          search={ua.search} setSearch={ua.setSearch}
          roleFilter={ua.roleFilter} setRoleFilter={ua.setRoleFilter}
          moduleFilter={ua.moduleFilter} setModuleFilter={ua.setModuleFilter}
          statusFilter={ua.statusFilter} setStatusFilter={ua.setStatusFilter}
          onReload={ua.reload}
          loading={ua.loading}
        />

        <UsersTable
          items={ua.items}
          selectedId={ua.selectedId}
          onSelect={ua.setSelectedId}
          loading={ua.loading}
          error={ua.error}
          onLoadMore={ua.loadMore}
          nextCursor={ua.nextCursor}
        />
      </main>

      <UserDetailDrawer
        open={!!ua.selectedId}
        detail={ua.detail}
        loading={ua.detailLoading}
        onClose={() => ua.setSelectedId(null)}
        currentUserId={ua.currentUserId}
        currentRole={ua.currentRole}
        onAddRole={ua.addRole}
        onRemoveRole={ua.removeRole}
        onSetModuleGrant={ua.setModuleGrant}
        onSuspend={ua.suspendUser}
        onReactivate={ua.reactivateUser}
        onRevokeSessions={ua.revokeSessions}
      />

      {ua.toast ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 95,
            padding: "10px 14px", background: "var(--ac-text)", color: "var(--ac-surface)",
            borderRadius: "var(--ac-radius)", boxShadow: "var(--ac-shadow-2)",
            fontSize: 13,
          }}
        >
          {ua.toast}
        </div>
      ) : null}
    </div>
  );
}

export default function UserAdminModule() {
  return (
    <SkinProvider>
      <ModuleInner />
    </SkinProvider>
  );
}
