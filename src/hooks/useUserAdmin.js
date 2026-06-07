// ═══════════════════════════════════════════════════════════════════════════
// src/hooks/useUserAdmin.js — state hook for /hub/admin/users
// ───────────────────────────────────────────────────────────────────────────
// Owns list state, filters, selected user detail, mutations against
// /api/admin/users/*. Uses the bearer JWT from BmcAuthProvider; assumes the
// component is wrapped in <RequireGrant role="admin"> upstream.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBmcAuth } from "./useBmcAuth.js";

async function apiFetch(token, path, options = {}) {
  const { timeoutMs = 30000, ...rest } = options;
  const headers = { ...(rest.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, { ...rest, headers, signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    if (e.name === "AbortError") return { ok: false, status: 0, data: { error: "timeout" } };
    return { ok: false, status: 0, data: { error: e.message || "network_error" } };
  } finally {
    clearTimeout(timer);
  }
}

export const ALL_MODULES = [
  "calc", "wa", "ml", "admin", "plan-import",
  "agent-admin", "canales", "crm-personal", "tareas",
];
export const ALL_ROLES = ["comprador", "operator", "admin", "superadmin"];
export const ALL_LEVELS = ["none", "read", "write", "admin"];

export function useUserAdmin() {
  const auth = useBmcAuth();
  const token = auth.accessToken;

  // List state
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Selected detail
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  // Debounced search
  const searchDebounceRef = useRef(null);
  const [searchDebounced, setSearchDebounced] = useState("");
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearchDebounced(search), 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [search]);

  // Load list (also called on filter changes)
  const load = useCallback(async (opts = {}) => {
    if (!token) return;
    const append = !!opts.append;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (searchDebounced) params.set("search", searchDebounced);
    if (roleFilter) params.set("role", roleFilter);
    if (moduleFilter) params.set("module", moduleFilter);
    if (statusFilter) params.set("status", statusFilter);
    params.set("limit", "50");
    if (append && nextCursor) {
      params.set("cursor_ts", new Date(nextCursor.ts).toISOString());
      params.set("cursor_id", nextCursor.id);
    }
    const r = await apiFetch(token, `/api/admin/users?${params.toString()}`);
    setLoading(false);
    if (!r.ok) {
      setError(r.data?.error || `http_${r.status}`);
      return;
    }
    setItems((prev) => append ? [...prev, ...(r.data.items || [])] : (r.data.items || []));
    setNextCursor(r.data.next_cursor || null);
  }, [token, searchDebounced, roleFilter, moduleFilter, statusFilter, nextCursor]);

  // Re-load whenever filters change (no append)
  useEffect(() => {
    if (token) load({ append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, searchDebounced, roleFilter, moduleFilter, statusFilter]);

  // Load detail when selected
  useEffect(() => {
    if (!selectedId || !token) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    apiFetch(token, `/api/admin/users/${selectedId}`).then((r) => {
      if (cancelled) return;
      setDetailLoading(false);
      if (r.ok) setDetail(r.data);
      else { setDetail(null); showToast(`Error: ${r.data?.error || r.status}`); }
    });
    return () => { cancelled = true; };
  }, [selectedId, token, showToast]);

  const refreshDetail = useCallback(async () => {
    if (!selectedId || !token) return;
    const r = await apiFetch(token, `/api/admin/users/${selectedId}`);
    if (r.ok) setDetail(r.data);
  }, [selectedId, token]);

  // Mutations
  const addRole = useCallback(async (userId, role) => {
    const r = await apiFetch(token, `/api/admin/users/${userId}/role-grants`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!r.ok) { showToast(`Error: ${r.data?.error || r.status}`); return false; }
    showToast(`Rol ${role} agregado`);
    await Promise.all([load({ append: false }), refreshDetail()]);
    return true;
  }, [token, load, refreshDetail, showToast]);

  const removeRole = useCallback(async (userId, role) => {
    const r = await apiFetch(token, `/api/admin/users/${userId}/role-grants/${role}`, {
      method: "DELETE",
    });
    if (!r.ok) { showToast(`Error: ${r.data?.error || r.status}`); return false; }
    showToast(`Rol ${role} quitado`);
    await Promise.all([load({ append: false }), refreshDetail()]);
    return true;
  }, [token, load, refreshDetail, showToast]);

  const setModuleGrant = useCallback(async (userId, module, level) => {
    const r = await apiFetch(token, `/api/admin/users/${userId}/module-grants/${module}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level }),
    });
    if (!r.ok) { showToast(`Error: ${r.data?.error || r.status}`); return false; }
    showToast(`${module}: ${level}`);
    await Promise.all([load({ append: false }), refreshDetail()]);
    return true;
  }, [token, load, refreshDetail, showToast]);

  const suspendUser = useCallback(async (userId, reason) => {
    const r = await apiFetch(token, `/api/admin/users/${userId}/suspend`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!r.ok) { showToast(`Error: ${r.data?.error || r.status}`); return false; }
    showToast("Usuario suspendido");
    await Promise.all([load({ append: false }), refreshDetail()]);
    return true;
  }, [token, load, refreshDetail, showToast]);

  const reactivateUser = useCallback(async (userId) => {
    const r = await apiFetch(token, `/api/admin/users/${userId}/reactivate`, { method: "POST" });
    if (!r.ok) { showToast(`Error: ${r.data?.error || r.status}`); return false; }
    showToast("Usuario reactivado");
    await Promise.all([load({ append: false }), refreshDetail()]);
    return true;
  }, [token, load, refreshDetail, showToast]);

  const revokeSessions = useCallback(async (userId) => {
    const r = await apiFetch(token, `/api/admin/users/${userId}/revoke-sessions`, { method: "POST" });
    if (!r.ok) { showToast(`Error: ${r.data?.error || r.status}`); return false; }
    showToast(`${r.data.revoked_count || 0} sesiones revocadas`);
    await refreshDetail();
    return true;
  }, [token, refreshDetail, showToast]);

  // Derived stats
  const stats = useMemo(() => {
    const total = items.length;
    const admins = items.filter((u) => (u.roles || []).some((r) => r === "admin" || r === "superadmin")).length;
    const suspended = items.filter((u) => u.status === "suspended").length;
    const cutoff30 = Date.now() - 30 * 24 * 3600 * 1000;
    const active30 = items.filter((u) => u.last_active_at && new Date(u.last_active_at).getTime() > cutoff30).length;
    return { total, active30, admins, suspended };
  }, [items]);

  return {
    // list
    items, stats, loading, error,
    nextCursor, loadMore: () => load({ append: true }),
    reload: () => load({ append: false }),
    // filters
    search, setSearch,
    roleFilter, setRoleFilter,
    moduleFilter, setModuleFilter,
    statusFilter, setStatusFilter,
    // detail
    selectedId, setSelectedId,
    detail, detailLoading,
    // mutations
    addRole, removeRole, setModuleGrant, suspendUser, reactivateUser, revokeSessions,
    // toast
    toast,
    // current user (so UI can guard self-modification)
    currentUserId: auth.user?.id,
    currentRole: auth.role,
  };
}

// ─── UserCombobox API helper (shared with TraKtiMe Track D) ───────────────
export async function searchUsersForCombobox(token, query, limit = 10) {
  if (!query || query.length < 2) return [];
  const params = new URLSearchParams({ search: query, limit: String(limit) });
  const r = await apiFetch(token, `/api/admin/users?${params.toString()}`);
  if (!r.ok) return [];
  return (r.data.items || []).map((u) => ({
    user_id: u.user_id,
    email: u.email,
    name: u.name,
    roles: u.roles || [],
  }));
}
