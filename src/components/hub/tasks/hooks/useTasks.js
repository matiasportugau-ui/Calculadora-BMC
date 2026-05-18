// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/tasks/hooks/useTasks.js — TanStack Query hooks for Tasks
// ───────────────────────────────────────────────────────────────────────────
// Exposes fetching and mutation hooks for task lists and individual tasks.
// Implements TanStack Query v5 with 60s staleTime and 5min gcTime.
// Queries hit /api/tasks/* endpoints (managed by server/routes/tasks.js).
//
// Phase 0: Hook scaffolds with interface definitions.
// Phase 1: Implement query clients, mutations, error handling, offline queue via IndexedDB.
// ═══════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─────────────────────────────────────────────────────────────────────────────
// Query Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch user's task lists from /api/tasks/lists
 * TODO Phase 1: Implement query with staleTime=60s, gcTime=5min
 * @returns { data: { ok, lists, nextPageToken }, isLoading, error }
 */
export function useTaskLists() {
  // TODO Phase 1:
  // return useQuery({
  //   queryKey: ["tasks", "lists"],
  //   queryFn: async () => {
  //     const res = await fetch("/api/tasks/lists", {
  //       headers: { Authorization: `Bearer ${getToken()}` },
  //     });
  //     if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
  //     return res.json();
  //   },
  //   staleTime: 60000, // 60s
  //   gcTime: 5 * 60000, // 5min
  // });

  return {
    data: { ok: false, lists: [], nextPageToken: null },
    isLoading: true,
    error: new Error("Phase 1: useTaskLists not implemented"),
  };
}

/**
 * Fetch single task list metadata from /api/tasks/lists/:id
 * TODO Phase 1: Implement query with staleTime=60s, gcTime=5min
 * @param {string} listId - Task list UUID
 * @returns { data: { ok, list }, isLoading, error }
 */
export function useTaskList(listId) {
  // TODO Phase 1:
  // return useQuery({
  //   queryKey: ["tasks", "lists", listId],
  //   queryFn: async () => {
  //     const res = await fetch(`/api/tasks/lists/${listId}`, {
  //       headers: { Authorization: `Bearer ${getToken()}` },
  //     });
  //     if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
  //     return res.json();
  //   },
  //   staleTime: 60000,
  //   gcTime: 5 * 60000,
  //   enabled: !!listId,
  // });

  return {
    data: { ok: false, list: null },
    isLoading: true,
    error: new Error("Phase 1: useTaskList not implemented"),
  };
}

/**
 * Fetch tasks in a list from /api/tasks/lists/:id/tasks with pagination
 * TODO Phase 1: Implement query with staleTime=60s, gcTime=5min, nextPageToken
 * @param {string} listId - Task list UUID
 * @param {string} pageToken - Optional pagination token
 * @returns { data: { ok, tasks, nextPageToken }, isLoading, error }
 */
export function useTasks(listId, pageToken = null) {
  // TODO Phase 1:
  // return useQuery({
  //   queryKey: ["tasks", "lists", listId, "tasks", pageToken],
  //   queryFn: async () => {
  //     const url = new URL(`/api/tasks/lists/${listId}/tasks`, location.origin);
  //     if (pageToken) url.searchParams.set("pageToken", pageToken);
  //     const res = await fetch(url.toString(), {
  //       headers: { Authorization: `Bearer ${getToken()}` },
  //     });
  //     if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
  //     return res.json();
  //   },
  //   staleTime: 60000,
  //   gcTime: 5 * 60000,
  //   enabled: !!listId,
  // });

  return {
    data: { ok: false, tasks: [], nextPageToken: null },
    isLoading: true,
    error: new Error("Phase 1: useTasks not implemented"),
  };
}

/**
 * Fetch single task from /api/tasks/lists/:id/tasks/:taskId
 * TODO Phase 1: Implement query with staleTime=60s, gcTime=5min
 * @param {string} listId - Task list UUID
 * @param {string} taskId - Task UUID
 * @returns { data: { ok, task }, isLoading, error }
 */
export function useTask(listId, taskId) {
  // TODO Phase 1:
  // return useQuery({
  //   queryKey: ["tasks", "lists", listId, "tasks", taskId],
  //   queryFn: async () => {
  //     const res = await fetch(`/api/tasks/lists/${listId}/tasks/${taskId}`, {
  //       headers: { Authorization: `Bearer ${getToken()}` },
  //     });
  //     if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
  //     return res.json();
  //   },
  //   staleTime: 60000,
  //   gcTime: 5 * 60000,
  //   enabled: !!listId && !!taskId,
  // });

  return {
    data: { ok: false, task: null },
    isLoading: true,
    error: new Error("Phase 1: useTask not implemented"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutation Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create task list via POST /api/tasks/lists
 * TODO Phase 1: Implement mutation with optimistic UI + IndexedDB offline queue
 * @returns { mutate, isPending, error }
 */
export function useCreateTaskList() {
  const queryClient = useQueryClient();

  // TODO Phase 1:
  // return useMutation({
  //   mutationFn: async ({ title, description }) => {
  //     const res = await fetch("/api/tasks/lists", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${getToken()}`,
  //       },
  //       body: JSON.stringify({ title, description }),
  //     });
  //     if (!res.ok) throw new Error(`Create failed: ${res.statusText}`);
  //     return res.json();
  //   },
  //   onSuccess: (data) => {
  //     queryClient.invalidateQueries({ queryKey: ["tasks", "lists"] });
  //   },
  // });

  return {
    mutate: () => console.error("Phase 1: useCreateTaskList not implemented"),
    isPending: false,
    error: null,
  };
}

/**
 * Delete task list via DELETE /api/tasks/lists/:id
 * TODO Phase 1: Implement mutation with soft-delete propagation
 * @returns { mutate, isPending, error }
 */
export function useDeleteTaskList() {
  const queryClient = useQueryClient();

  // TODO Phase 1:
  // return useMutation({
  //   mutationFn: async (listId) => {
  //     const res = await fetch(`/api/tasks/lists/${listId}`, {
  //       method: "DELETE",
  //       headers: { Authorization: `Bearer ${getToken()}` },
  //     });
  //     if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`);
  //     return res.json();
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ["tasks", "lists"] });
  //   },
  // });

  return {
    mutate: () => console.error("Phase 1: useDeleteTaskList not implemented"),
    isPending: false,
    error: null,
  };
}

/**
 * Create task via POST /api/tasks/lists/:id/tasks
 * TODO Phase 1: Implement mutation with optimistic UI, retry via IndexedDB queue
 * @returns { mutate, isPending, error }
 */
export function useCreateTask(listId) {
  const queryClient = useQueryClient();

  // TODO Phase 1:
  // return useMutation({
  //   mutationFn: async ({ title, notes, due, parent }) => {
  //     const res = await fetch(`/api/tasks/lists/${listId}/tasks`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${getToken()}`,
  //       },
  //       body: JSON.stringify({ title, notes, due, parent }),
  //     });
  //     if (!res.ok) throw new Error(`Create failed: ${res.statusText}`);
  //     return res.json();
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({
  //       queryKey: ["tasks", "lists", listId, "tasks"],
  //     });
  //   },
  // });

  return {
    mutate: () => console.error("Phase 1: useCreateTask not implemented"),
    isPending: false,
    error: null,
  };
}

/**
 * Update task via PATCH /api/tasks/lists/:id/tasks/:taskId
 * TODO Phase 1: Implement mutation with conflict detection
 * @returns { mutate, isPending, error }
 */
export function useUpdateTask(listId, taskId) {
  const queryClient = useQueryClient();

  // TODO Phase 1:
  // return useMutation({
  //   mutationFn: async ({ title, notes, due, status }) => {
  //     const res = await fetch(`/api/tasks/lists/${listId}/tasks/${taskId}`, {
  //       method: "PATCH",
  //       headers: {
  //         "Content-Type": "application/json",
  //         Authorization: `Bearer ${getToken()}`,
  //       },
  //       body: JSON.stringify({ title, notes, due, status }),
  //     });
  //     if (!res.ok) throw new Error(`Update failed: ${res.statusText}`);
  //     return res.json();
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({
  //       queryKey: ["tasks", "lists", listId, "tasks", taskId],
  //     });
  //   },
  // });

  return {
    mutate: () => console.error("Phase 1: useUpdateTask not implemented"),
    isPending: false,
    error: null,
  };
}

/**
 * Delete task via DELETE /api/tasks/lists/:id/tasks/:taskId
 * TODO Phase 1: Implement soft-delete mutation
 * @returns { mutate, isPending, error }
 */
export function useDeleteTask(listId, taskId) {
  const queryClient = useQueryClient();

  // TODO Phase 1:
  // return useMutation({
  //   mutationFn: async () => {
  //     const res = await fetch(`/api/tasks/lists/${listId}/tasks/${taskId}`, {
  //       method: "DELETE",
  //       headers: { Authorization: `Bearer ${getToken()}` },
  //     });
  //     if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`);
  //     return res.json();
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({
  //       queryKey: ["tasks", "lists", listId, "tasks"],
  //     });
  //   },
  // });

  return {
    mutate: () => console.error("Phase 1: useDeleteTask not implemented"),
    isPending: false,
    error: null,
  };
}

// TODO Phase 1: Implement helper function to extract JWT from sessionStorage/localStorage
// function getToken() {
//   return sessionStorage.getItem("jwt_token") || localStorage.getItem("jwt_token");
// }
