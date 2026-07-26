/**
 * useProviderReadiness — poll GET /api/agent/providers/status (SDD Phase C).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../utils/apiClient.js";

const DEFAULT_POLL_MS = 60_000;

/**
 * @param {{ enabled?: boolean, pollMs?: number, deep?: boolean }} [opts]
 */
export function useProviderReadiness(opts = {}) {
  const enabled = opts.enabled !== false;
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  const [readiness, setReadiness] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const refresh = useCallback(
    async ({ deep = false } = {}) => {
      if (!enabled) return null;
      setLoading(true);
      try {
        const path = deep
          ? "/api/agent/providers/status?deep=1"
          : "/api/agent/providers/status";
        const { data } = await apiGet(path);
        if (data?.ok) {
          setReadiness(data);
          setError(null);
          return data;
        }
        setError(data?.error || "status_failed");
        return null;
      } catch (e) {
        // Fallback: ai-options readiness envelope (may still work without status auth in some setups)
        try {
          const { data } = await apiGet("/api/agent/ai-options");
          if (data?.readiness) {
            const envelope = {
              ok: true,
              ready: !!data.readiness.ready,
              light: data.readiness.light || "gray",
              activeProvider: data.readiness.activeProvider || null,
              providers: Array.isArray(data.providers)
                ? data.providers.map((p) => ({
                    id: p.id,
                    light: p.light || "gray",
                    state: p.state || "unknown",
                    reason: p.reason || null,
                    reasonCode: p.reasonCode || null,
                    configured: true,
                  }))
                : [],
              generatedAt: new Date().toISOString(),
              _source: "ai-options",
            };
            setReadiness(envelope);
            setError(null);
            return envelope;
          }
        } catch {
          /* ignore */
        }
        setError(e?.message || "status_error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [enabled],
  );

  const forceProbe = useCallback(async (providers) => {
    setLoading(true);
    try {
      const { data } = await apiPost("/api/agent/providers/probe", {
        providers: providers || undefined,
      });
      if (data?.ok) {
        setReadiness(data);
        setError(null);
        return data;
      }
      setError(data?.error || "probe_failed");
      return null;
    } catch (e) {
      setError(e?.message || "probe_error");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh({ deep: false });
    timerRef.current = setInterval(() => refresh({ deep: false }), pollMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, pollMs, refresh]);

  return {
    readiness,
    error,
    loading,
    refresh,
    forceProbe,
    ready: !!readiness?.ready,
    light: readiness?.light || "gray",
    activeProvider: readiness?.activeProvider || null,
  };
}

export default useProviderReadiness;
