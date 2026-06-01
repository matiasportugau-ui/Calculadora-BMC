// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/clientes/hooks/useClientes.js — TanStack Query hooks
// for Clientes 360 MVP.
// ───────────────────────────────────────────────────────────────────────────
// Pulls accessToken from BmcAuthProvider context. Pattern mirrors
// src/components/hub/tasks/hooks/useTasks.js.
// ═══════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBmcAuthContext } from "../../../../contexts/bmcAuthContext.js";

const STALE_TIME_MS = 30_000;
const GC_TIME_MS = 5 * 60_000;

async function apiFetch(url, accessToken, init = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `http_${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

// ─── Customers list ────────────────────────────────────────────────────────

export function useCustomers({ filter = "all", search = "", limit = 100 } = {}) {
  const { accessToken } = useBmcAuthContext();
  const qs = new URLSearchParams({ filter, search, limit: String(limit) });
  return useQuery({
    queryKey: ["clientes", "customers", { filter, search, limit }],
    queryFn: () => apiFetch(`/api/clientes/customers?${qs}`, accessToken),
    enabled: !!accessToken,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

export function useCustomersSummary() {
  const { accessToken } = useBmcAuthContext();
  return useQuery({
    queryKey: ["clientes", "customers", "summary"],
    queryFn: () => apiFetch(`/api/clientes/customers/summary`, accessToken),
    enabled: !!accessToken,
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    refetchOnWindowFocus: false,
  });
}

// ─── Follow-ups ────────────────────────────────────────────────────────────

export function useMarkContacted() {
  const { accessToken } = useBmcAuthContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, reason }) =>
      apiFetch(`/api/clientes/followups`, accessToken, {
        method: "POST",
        body: JSON.stringify({ customer_id: customerId, reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes", "customers"] });
    },
  });
}
