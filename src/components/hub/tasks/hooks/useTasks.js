// ═══════════════════════════════════════════════════════════════════════════
// src/components/hub/tasks/hooks/useTasks.js — TanStack Query hooks for Tasks
// ───────────────────────────────────────────────────────────────────────────
// Real implementation against /api/tasks/* endpoints.
// Auth: pulls accessToken from BmcAuthProvider context.
//
// WRITE endpoints currently return 503 from the backend (sync not configured).
// Mutations catch this and surface a structured error so the UI can display
// "Conectá Google Tasks para crear/editar tareas" instead of a generic failure.
// Once OAuth/sync are provisioned, the same mutations start working without
// any client-side code change.
//
// Query keys:
//   ["tasks", "lists"]                              — all lists for user
//   ["tasks", "lists", listId]                      — one list metadata
//   ["tasks", "lists", listId, "tasks", afterId]    — tasks page in a list
//   ["tasks", "lists", listId, "tasks", "single", taskId] — single task
// ═══════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useBmcAuthContext } from "../../../../contexts/bmcAuthContext.js";

const STALE_TIME_MS = 60_000; // 60s — sync cycle period
const GC_TIME_MS = 5 * 60_000; // 5min

// ─────────────────────────────────────────────────────────────────────────────
// Fetch helper: attaches Bearer token + parses 503 specially
// ─────────────────────────────────────────────────────────────────────────────

async function apiFetch(url, accessToken, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 503) {
    const err = new Error(body.message || body.error || "service_unavailable");
    err.code = body.error || "service_unavailable";
    err.status = 503;
    err.unavailable = true;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(body.error || res.statusText);
    err.code = body.error || "http_error";
    err.status = res.status;
    throw err;
  }
  return body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch user's task lists from /api/tasks/lists.
 * @returns { data: { ok, lists: [] }, isLoading, error, refetch }
 */
export function useTaskLists() {
  const { accessToken } = useBmcAuthContext();
  return useQuery({
    queryKey: ["tasks", "lists"],
    queryFn: () => apiFetch("/api/tasks/lists", accessToken),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    enabled: !!accessToken,
  });
}

/**
 * Fetch single task list metadata from /api/tasks/lists/:id
 * @param {string} listId — Task list UUID
 */
export function useTaskList(listId) {
  const { accessToken } = useBmcAuthContext();
  return useQuery({
    queryKey: ["tasks", "lists", listId],
    queryFn: () => apiFetch(`/api/tasks/lists/${listId}`, accessToken),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    enabled: !!accessToken && !!listId,
  });
}

/**
 * Fetch tasks in a list with keyset pagination.
 * @param {string} listId — Task list UUID
 * @param {string|null} afterId — Pagination cursor (last task id from previous page)
 */
export function useTasks(listId, afterId = null) {
  const { accessToken } = useBmcAuthContext();
  return useQuery({
    queryKey: ["tasks", "lists", listId, "tasks", afterId],
    queryFn: () => {
      const u = new URL(`/api/tasks/lists/${listId}/tasks`, window.location.origin);
      if (afterId) u.searchParams.set("afterId", afterId);
      return apiFetch(u.pathname + u.search, accessToken);
    },
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    enabled: !!accessToken && !!listId,
  });
}

/**
 * Fetch single task from /api/tasks/lists/:id/tasks/:taskId
 */
export function useTask(listId, taskId) {
  const { accessToken } = useBmcAuthContext();
  return useQuery({
    queryKey: ["tasks", "lists", listId, "tasks", "single", taskId],
    queryFn: () =>
      apiFetch(`/api/tasks/lists/${listId}/tasks/${taskId}`, accessToken),
    staleTime: STALE_TIME_MS,
    gcTime: GC_TIME_MS,
    enabled: !!accessToken && !!listId && !!taskId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutation Hooks (all currently return 503 from backend until sync configured)
// ─────────────────────────────────────────────────────────────────────────────

/** Create task list via POST /api/tasks/lists. Body: { title, description? } */
export function useCreateTaskList() {
  const { accessToken } = useBmcAuthContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, description }) =>
      apiFetch("/api/tasks/lists", accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", "lists"] }),
  });
}

/** Delete task list via DELETE /api/tasks/lists/:id (soft-delete) */
export function useDeleteTaskList() {
  const { accessToken } = useBmcAuthContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId) =>
      apiFetch(`/api/tasks/lists/${listId}`, accessToken, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", "lists"] }),
  });
}

/** Create task in list. Body: { title, notes?, due?, parent_id? } */
export function useCreateTask(listId) {
  const { accessToken } = useBmcAuthContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, notes, due, parent_id }) =>
      apiFetch(`/api/tasks/lists/${listId}/tasks`, accessToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, notes, due, parent_id }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["tasks", "lists", listId, "tasks"] }),
  });
}

/** Update task. Body: any subset of { title, notes, due, status, parent_id } */
export function useUpdateTask(listId, taskId) {
  const { accessToken } = useBmcAuthContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch) =>
      apiFetch(`/api/tasks/lists/${listId}/tasks/${taskId}`, accessToken, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["tasks", "lists", listId, "tasks"],
      });
      queryClient.invalidateQueries({
        queryKey: ["tasks", "lists", listId, "tasks", "single", taskId],
      });
    },
  });
}

/** Soft-delete a task */
export function useDeleteTask(listId, taskId) {
  const { accessToken } = useBmcAuthContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/api/tasks/lists/${listId}/tasks/${taskId}`, accessToken, {
        method: "DELETE",
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["tasks", "lists", listId, "tasks"] }),
  });
}
