import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mlFetch } from '../utils/mlFetch.js';

// All hooks target the LIVE panelin-calc backend ML routes (server/index.js).
// Endpoints that the roadmap imagined but the backend does NOT expose
// (ads, analytics, message-packs, listing visits, ai/daily-brief) are
// intentionally absent — adding them here would only produce 404s.

const BASE_KEY = ['ml'];
const STALE_TIME = 30_000;
const GC_TIME = 5 * 60_000;

const qs = (params = {}) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

/** OAuth connection status — GET /auth/ml/status → { ok, userId, scope, updatedAt, expiresAt } */
export function useConnectorStatus() {
  return useQuery({
    queryKey: [...BASE_KEY, 'status'],
    queryFn: () =>
      mlFetch('/auth/ml/status').catch((err) => {
        if (err.status === 404) return { ok: false };
        throw err;
      }),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 0,
  });
}

/** Seller profile — GET /ml/users/me */
export function useUserMe() {
  return useQuery({
    queryKey: [...BASE_KEY, 'users', 'me'],
    queryFn: () => mlFetch('/ml/users/me'),
    staleTime: 5 * 60_000,
    gcTime: GC_TIME,
    retry: 0,
  });
}

/** Listings — GET /ml/listings?status=&limit=&offset= → { results, paging } */
export function useListings(params = {}) {
  return useQuery({
    queryKey: [...BASE_KEY, 'listings', params],
    queryFn: () =>
      mlFetch(`/ml/listings${qs({ status: params.status, limit: params.limit || 50, offset: params.offset || 0 })}`),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/** Single item detail — GET /ml/items/:id */
export function useItem(id) {
  return useQuery({
    queryKey: [...BASE_KEY, 'item', id],
    queryFn: () => mlFetch(`/ml/items/${id}`),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    enabled: !!id,
  });
}

/**
 * Update an item — PATCH /ml/items/:id (backend maps to ML PUT /items/:id).
 * `updates` may include: price, available_quantity, status ('active'|'paused'|'closed'),
 * attributes, and pictures: [{ source: 'https://…' }] to replace photos.
 */
export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }) =>
      mlFetch(`/ml/items/${id}`, { method: 'PATCH', body: updates }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [...BASE_KEY, 'item', id] });
      qc.invalidateQueries({ queryKey: [...BASE_KEY, 'listings'] });
    },
  });
}

/** Update an item description — POST /ml/items/:id/description { text } */
export function useUpdateDescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }) =>
      mlFetch(`/ml/items/${id}/description`, { method: 'POST', body: { text } }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: [...BASE_KEY, 'item', id] });
    },
  });
}

/**
 * Unanswered questions — GET /ml/questions?status=&limit=&offset=
 * ML's /questions/search returns { total, questions: [...] } (count at top level,
 * array under `questions`, no `paging`), unlike items/orders which use
 * { results, paging }. Normalize here so the tabs can read `.results` and
 * `.paging.total` uniformly.
 */
export function useQuestions(params = {}) {
  return useQuery({
    queryKey: [...BASE_KEY, 'questions', params],
    queryFn: () =>
      mlFetch(
        `/ml/questions${qs({ status: params.status || 'UNANSWERED', limit: params.limit || 50, offset: params.offset || 0 })}`
      ).then((d) => ({
        results: d?.questions ?? d?.results ?? [],
        paging: {
          total: d?.total ?? d?.paging?.total ?? 0,
          limit: d?.limit ?? d?.paging?.limit,
          offset: d?.offset ?? d?.paging?.offset,
        },
      })),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/** Answer a question — POST /ml/questions/:id/answer { text } */
export function useAnswerQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }) =>
      mlFetch(`/ml/questions/${id}/answer`, { method: 'POST', body: { text } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...BASE_KEY, 'questions'] });
    },
  });
}

/** Orders — GET /ml/orders?limit=&offset= → { results, paging } */
export function useOrders(params = {}) {
  return useQuery({
    queryKey: [...BASE_KEY, 'orders', params],
    queryFn: () =>
      mlFetch(`/ml/orders${qs({ 'order.status': params.status, limit: params.limit || 50, offset: params.offset || 0 })}`),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}
