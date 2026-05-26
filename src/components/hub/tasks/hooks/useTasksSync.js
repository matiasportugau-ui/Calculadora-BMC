// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/tasks/hooks/useTasksSync.js — Sync status & conflicts
// ═══════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBmcAuthContext } from "../../../../contexts/bmcAuthContext.js";

async function apiFetch(url, accessToken, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || res.statusText);
    err.status = res.status;
    throw err;
  }
  return body;
}

export function useSyncStatus() {
  const { accessToken } = useBmcAuthContext();
  return useQuery({
    queryKey: ["tasks", "sync", "status"],
    queryFn: () => apiFetch("/api/tasks/sync/status", accessToken),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    enabled: !!accessToken,
  });
}

export function useSyncConflicts() {
  const { accessToken } = useBmcAuthContext();
  return useQuery({
    queryKey: ["tasks", "sync", "conflicts"],
    queryFn: () => apiFetch("/api/tasks/sync/conflicts", accessToken),
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchInterval: 30_000,
    enabled: !!accessToken,
  });
}

export function useResolveConflict() {
  const { accessToken } = useBmcAuthContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conflictId, resolution }) =>
      apiFetch(`/api/tasks/sync/conflicts/${conflictId}`, accessToken, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "sync", "conflicts"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "sync", "status"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "lists"] });
    },
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "lists"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", "sync", "status"] });
    },
  });
}
