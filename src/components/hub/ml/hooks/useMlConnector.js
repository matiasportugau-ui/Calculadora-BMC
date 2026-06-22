import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mlFetch } from '../utils/mlFetch.js';

const BASE_KEY = ['ml'];
const STALE_TIME = 30_000;
const GC_TIME = 5 * 60_000;

export function useConnectorStatus() {
  return useQuery({
    queryKey: [...BASE_KEY, 'status'],
    queryFn: () => mlFetch('/auth/ml/status'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

export function useListings(params = {}) {
  return useQuery({
    queryKey: [...BASE_KEY, 'listings', params],
    queryFn: () => mlFetch(`/ml/listings?limit=${params.limit || 50}&offset=${params.offset || 0}`),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

export function useListingVisits(id) {
  return useQuery({
    queryKey: [...BASE_KEY, 'listing', id, 'visits'],
    queryFn: () => mlFetch(`/ml/listings/${id}/visits?last=7d`),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    enabled: !!id,
  });
}

export function useUnreadMessages() {
  return useQuery({
    queryKey: [...BASE_KEY, 'messages', 'unread'],
    queryFn: () => mlFetch('/ml/messages/unread'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

export function useMessagePack(packId) {
  return useQuery({
    queryKey: [...BASE_KEY, 'message-pack', packId],
    queryFn: () => mlFetch(`/ml/messages/packs/${packId}`),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    enabled: !!packId,
  });
}

export function useCampaigns() {
  return useQuery({
    queryKey: [...BASE_KEY, 'campaigns'],
    queryFn: () => mlFetch('/ml/ads/campaigns'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

export function useCampaignAds(campaignId) {
  return useQuery({
    queryKey: [...BASE_KEY, 'campaign', campaignId, 'ads'],
    queryFn: () => mlFetch(`/ml/ads/campaigns/${campaignId}/ads`),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    enabled: !!campaignId,
  });
}

export function useAdReports() {
  return useQuery({
    queryKey: [...BASE_KEY, 'ads', 'reports'],
    queryFn: () => mlFetch('/ml/ads/reports/summary'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

export function useReputation() {
  return useQuery({
    queryKey: [...BASE_KEY, 'analytics', 'reputation'],
    queryFn: () => mlFetch('/ml/analytics/reputation'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

export function useSales(params = {}) {
  return useQuery({
    queryKey: [...BASE_KEY, 'analytics', 'sales', params],
    queryFn: () => mlFetch(`/ml/analytics/sales?limit=${params.limit || 50}&offset=${params.offset || 0}`),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

export function useItemQuality() {
  return useQuery({
    queryKey: [...BASE_KEY, 'analytics', 'items', 'quality'],
    queryFn: () => mlFetch('/ml/analytics/items/quality'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

export function useDailyBrief() {
  return useQuery({
    queryKey: [...BASE_KEY, 'ai', 'daily-brief'],
    queryFn: () => mlFetch('/ai/daily-brief'),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

export function useUpdateListingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) =>
      mlFetch(`/ml/listings/${id}/status`, {
        method: 'PATCH',
        body: { status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...BASE_KEY, 'listings'] });
    },
  });
}

export function useReplyToMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ packId, text }) =>
      mlFetch(`/ml/messages/packs/${packId}/reply`, {
        method: 'POST',
        body: { text },
      }),
    onSuccess: (_, { packId }) => {
      qc.invalidateQueries({ queryKey: [...BASE_KEY, 'message-pack', packId] });
    },
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }) =>
      mlFetch(`/ml/ads/campaigns/${id}`, {
        method: 'PUT',
        body: updates,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...BASE_KEY, 'campaigns'] });
    },
  });
}
