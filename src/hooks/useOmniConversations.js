import { useCallback, useEffect, useState } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";

async function omniFetch(token, path, options = {}) {
  const base = getCalcApiBase().replace(/\/+$/, "");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function useOmniConversations(token, { channel, status, limit = 50 } = {}) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (channel) params.set("channel", channel);
      if (status) params.set("status", status);
      const data = await omniFetch(token, `/api/omni/conversations?${params}`);
      setConversations(data.conversations || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, channel, status, limit]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Phase 2: operator-facing conversation update (status / tags / priority).
  const updateConversation = useCallback(
    async (id, patch) => {
      const data = await omniFetch(token, `/api/omni/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await reload();
      return data;
    },
    [token, reload],
  );

  return { conversations, loading, error, reload, updateConversation };
}

export function useOmniMessages(token, conversationId) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!token || !conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await omniFetch(token, `/api/omni/conversations/${conversationId}/messages`);
      setConversation(data.conversation || null);
      setMessages(data.messages || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, conversationId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const sendReply = useCallback(
    async (text) => {
      const data = await omniFetch(token, `/api/omni/conversations/${conversationId}/reply`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      await reload();
      return data;
    },
    [token, conversationId, reload],
  );

  const markRead = useCallback(async () => {
    await omniFetch(token, `/api/omni/conversations/${conversationId}/read`, {
      method: "PATCH",
    });
  }, [token, conversationId]);

  return { conversation, messages, loading, error, reload, sendReply, markRead };
}

export function useOmniDeals(token, { stage } = {}) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (stage) params.set("stage", stage);
      const data = await omniFetch(token, `/api/omni/deals?${params}`);
      setDeals(data.deals || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, stage]);

  useEffect(() => {
    reload();
  }, [reload]);

  const moveDeal = useCallback(
    async (dealId, nextStage) => {
      const data = await omniFetch(token, `/api/omni/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ stage: nextStage }),
      });
      await reload();
      return data;
    },
    [token, reload],
  );

  return { deals, loading, error, reload, moveDeal };
}

export function useOmniSuggestions(token, conversationId) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!token || !conversationId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ conversation_id: conversationId, limit: "5" });
      const data = await omniFetch(token, `/api/omni/suggestions?${params}`);
      setSuggestions(data.suggestions || []);
    } finally {
      setLoading(false);
    }
  }, [token, conversationId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const accept = useCallback(
    async (id) => {
      await omniFetch(token, `/api/omni/suggestions/${id}/accept`, { method: "POST", body: "{}" });
      await reload();
    },
    [token, reload],
  );

  const reject = useCallback(
    async (id) => {
      await omniFetch(token, `/api/omni/suggestions/${id}/reject`, { method: "POST", body: "{}" });
      await reload();
    },
    [token, reload],
  );

  return { suggestions, loading, reload, accept, reject };
}
