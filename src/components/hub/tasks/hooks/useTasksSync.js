// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/tasks/hooks/useTasksSync.js — Sync status & manual trigger
// ───────────────────────────────────────────────────────────────────────────
// Exposes sync status query and manual trigger mutation.
// Fetches from /sync/google-tasks/status (GET); triggers via /sync/google-tasks/pull (POST).
// Displays last sync time, pending items, conflicts, and allows manual sync.
//
// Phase 0: Hook scaffolds with interface definitions.
// Phase 1: Implement sync status queries, polling interval, Cloud Tasks job monitoring.
// ═══════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─────────────────────────────────────────────────────────────────────────────
// Query: Sync Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch sync status from /api/tasks/sync/status
 * TODO Phase 1: Implement query with polling (5s interval or longer if idle)
 * @returns {
 *   data: {
 *     ok: bool,
 *     lastSync: ISO 8601 or null,
 *     nextSync: ISO 8601 (estimated time of next cron),
 *     itemsSynced: number,
 *     conflicts: number,
 *     pendingMutations: number,
 *   },
 *   isLoading: bool,
 *   error: Error | null,
 * }
 */
export function useSyncStatus() {
  // TODO Phase 1:
  // return useQuery({
  //   queryKey: ["tasks", "sync", "status"],
  //   queryFn: async () => {
  //     const res = await fetch("/api/tasks/sync/status", {
  //       headers: { Authorization: `Bearer ${getToken()}` },
  //     });
  //     if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
  //     return res.json();
  //   },
  //   staleTime: 5000, // 5s; refresh often since cron updates every 60s
  //   gcTime: 5 * 60000, // 5min
  //   refetchInterval: 5000, // Poll every 5s (Phase 2: adaptive based on user idle)
  // });

  return {
    data: {
      ok: false,
      lastSync: null,
      nextSync: new Date(Date.now() + 60000).toISOString(),
      itemsSynced: 0,
      conflicts: 0,
      pendingMutations: 0,
    },
    isLoading: true,
    error: new Error("Phase 1: useSyncStatus not implemented"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutation: Manual Sync Trigger
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manually trigger sync via POST /sync/google-tasks/pull (or user-scoped variant)
 * TODO Phase 1: Implement mutation with Cloud Tasks job ID tracking
 * Allows user to force an immediate sync instead of waiting for cron window.
 * Rate-limited to 1 req/min per 02-mcp-server.md.
 *
 * @param {bool} force - If true, bypass deduplication and sync immediately
 * @returns {
 *   mutate(force?),
 *   isPending: bool,
 *   error: Error | null,
 *   data: { jobId, status, startedAt } | null,
 * }
 */
export function useTriggerSync() {
  const queryClient = useQueryClient();

  // TODO Phase 1:
  // return useMutation({
  //   mutationFn: async (force = false) => {
  //     const res = await fetch("/sync/google-tasks/pull", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${getToken()}`,
  //       },
  //       body: JSON.stringify({ force }),
  //     });
  //     if (!res.ok) {
  //       if (res.status === 429) {
  //         throw new Error("Rate limit hit; try again in 1 minute");
  //       }
  //       throw new Error(`Sync failed: ${res.statusText}`);
  //     }
  //     return res.json();
  //   },
  //   onSuccess: () => {
  //     // Invalidate sync status so it refetches immediately
  //     queryClient.invalidateQueries({
  //       queryKey: ["tasks", "sync", "status"],
  //     });
  //     // Also invalidate task lists and tasks in case Cloud Scheduler
  //     // already processed the sync before response
  //     queryClient.invalidateQueries({
  //       queryKey: ["tasks", "lists"],
  //     });
  //   },
  //   onError: (error) => {
  //     console.error("Sync trigger error:", error.message);
  //     // Attempt to refetch status anyway in case partial sync occurred
  //     queryClient.invalidateQueries({
  //       queryKey: ["tasks", "sync", "status"],
  //     });
  //   },
  // });

  return {
    mutate: () => console.error("Phase 1: useTriggerSync not implemented"),
    isPending: false,
    error: null,
    data: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Query: Sync Conflicts (for ConflictResolver UI)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch unresolved conflicts from /api/tasks/sync/conflicts
 * TODO Phase 1: Implement query to list soft-delete vs Google active mismatches
 * @returns {
 *   data: {
 *     ok: bool,
 *     conflicts: [
 *       {
 *         id: UUID,
 *         taskId: UUID,
 *         listId: UUID,
 *         conflictType: 'soft_delete_mismatch' | 'update_timestamp_mismatch' | 'concurrent_edit',
 *         hubVersion: { title, notes, due, status },
 *         googleVersion: { title, notes, due, status },
 *         created_at: ISO 8601,
 *         expires_at: ISO 8601,
 *       },
 *     ],
 *     totalCount: number,
 *   },
 *   isLoading: bool,
 *   error: Error | null,
 * }
 */
export function useSyncConflicts() {
  // TODO Phase 1:
  // return useQuery({
  //   queryKey: ["tasks", "sync", "conflicts"],
  //   queryFn: async () => {
  //     const res = await fetch("/api/tasks/sync/conflicts", {
  //       headers: { Authorization: `Bearer ${getToken()}` },
  //     });
  //     if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
  //     return res.json();
  //   },
  //   staleTime: 10000, // 10s
  //   gcTime: 5 * 60000, // 5min
  //   refetchInterval: 30000, // Poll every 30s for new conflicts
  // });

  return {
    data: {
      ok: false,
      conflicts: [],
      totalCount: 0,
    },
    isLoading: true,
    error: new Error("Phase 1: useSyncConflicts not implemented"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutation: Resolve Conflict
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a conflict via PATCH /api/tasks/sync/conflicts/:id
 * TODO Phase 1: Implement mutation to record resolution (take_google | take_hub | manual)
 * @returns {
 *   mutate({ conflictId, resolution }),
 *   isPending: bool,
 *   error: Error | null,
 * }
 */
export function useResolveConflict() {
  const queryClient = useQueryClient();

  // TODO Phase 1:
  // return useMutation({
  //   mutationFn: async ({ conflictId, resolution }) => {
  //     if (!["take_google", "take_hub", "manual"].includes(resolution)) {
  //       throw new Error(`Invalid resolution: ${resolution}`);
  //     }
  //     const res = await fetch(`/api/tasks/sync/conflicts/${conflictId}`, {
  //       method: "PATCH",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${getToken()}`,
  //       },
  //       body: JSON.stringify({ resolution }),
  //     });
  //     if (!res.ok) throw new Error(`Resolve failed: ${res.statusText}`);
  //     return res.json();
  //   },
  //   onSuccess: () => {
  //     // Invalidate conflicts list
  //     queryClient.invalidateQueries({
  //       queryKey: ["tasks", "sync", "conflicts"],
  //     });
  //     // Invalidate task lists and tasks (resolution may have synced data)
  //     queryClient.invalidateQueries({
  //       queryKey: ["tasks", "lists"],
  //     });
  //   },
  // });

  return {
    mutate: () => console.error("Phase 1: useResolveConflict not implemented"),
    isPending: false,
    error: null,
  };
}

// TODO Phase 1: Implement helper to extract JWT from sessionStorage/localStorage
// function getToken() {
//   return sessionStorage.getItem("jwt_token") || localStorage.getItem("jwt_token");
// }
