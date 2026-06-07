import { ALL_MODULES, ALL_ROLES } from "../../../hooks/useUserAdmin.js";

export default function UserToolbar({
  search, setSearch,
  roleFilter, setRoleFilter,
  moduleFilter, setModuleFilter,
  statusFilter, setStatusFilter,
  onReload,
  loading,
}) {
  return (
    <div
      className="adminCot__toolbar"
      style={{
        display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
        padding: "10px 12px", background: "var(--ac-surface)",
        border: "1px solid var(--ac-border)", borderRadius: "var(--ac-radius)",
        marginBottom: 12,
      }}
    >
      <input
        type="search"
        placeholder="Buscar por email o nombre…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          flex: "1 1 240px", minWidth: 200, padding: "8px 12px",
          borderRadius: "var(--ac-radius-sm)", border: "1px solid var(--ac-border)",
          fontSize: 14, background: "var(--ac-surface)", color: "var(--ac-text)",
          fontFamily: "var(--ac-font)",
        }}
        aria-label="Buscar usuarios"
      />
      <select
        value={roleFilter}
        onChange={(e) => setRoleFilter(e.target.value)}
        style={selStyle}
        aria-label="Filtrar por rol"
      >
        <option value="">Todos los roles</option>
        {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <select
        value={moduleFilter}
        onChange={(e) => setModuleFilter(e.target.value)}
        style={selStyle}
        aria-label="Filtrar por módulo"
      >
        <option value="">Todos los módulos</option>
        {ALL_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        style={selStyle}
        aria-label="Filtrar por estado"
      >
        <option value="">Todos los estados</option>
        <option value="active">Activo</option>
        <option value="suspended">Suspendido</option>
        <option value="deleted">Eliminado</option>
      </select>
      <button
        type="button"
        className="adminCot__btn adminCot__btn--sm"
        onClick={onReload}
        disabled={loading}
        title="Recargar lista"
      >
        {loading ? "Cargando…" : "↻"}
      </button>
    </div>
  );
}

const selStyle = {
  padding: "8px 10px",
  borderRadius: "var(--ac-radius-sm)",
  border: "1px solid var(--ac-border)",
  background: "var(--ac-surface)",
  color: "var(--ac-text)",
  fontSize: 13,
  fontFamily: "var(--ac-font)",
};
