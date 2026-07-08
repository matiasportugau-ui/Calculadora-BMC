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

export function useOmniConversations(
  token,
  { channel, status, accountId, assignedTo, teamId, limit = 50 } = {},
) {
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
      if (accountId) params.set("account_id", accountId);
      if (assignedTo) params.set("assigned_to", assignedTo);
      if (teamId) params.set("team_id", teamId);
      const data = await omniFetch(token, `/api/omni/conversations?${params}`);
      setConversations(data.conversations || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, channel, status, accountId, assignedTo, teamId, limit]);

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

// Email-manager (009): list of receiving mailboxes, for the inbox account filter.
// Degrades to [] if the endpoint/table isn't migrated yet (never blocks the panel).
export function useOmniAccounts(token) {
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    omniFetch(token, "/api/omni/accounts")
      .then((data) => {
        if (alive) setAccounts(data.accounts || []);
      })
      .catch(() => {
        if (alive) setAccounts([]);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  return accounts;
}

// Assignable operators (users with a `canales` grant), for the assign picker.
// Degrades to [] so the picker never blocks the panel.
export function useOmniAssignees(token) {
  const [assignees, setAssignees] = useState([]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    omniFetch(token, "/api/omni/assignees")
      .then((data) => {
        if (alive) setAssignees(data.assignees || []);
      })
      .catch(() => {
        if (alive) setAssignees([]);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  return assignees;
}

// Admin cockpit — management rollup over the email inbox (mailbox health,
// per-operator load, queues, SLA). Degrades to an empty snapshot so the panel
// never blocks. Manual refresh via reload().
export function useOmniAdminOverview(token) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await omniFetch(token, "/api/omni/admin/overview");
      setOverview(data);
    } catch (e) {
      setError(e.message);
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { overview, loading, error, reload };
}

// "Reply-zero" action queue: the ranked, per-conversation "act on THIS now" list
// from GET /api/omni/actions/urgent. Degrades to [] so the cockpit never breaks.
export function useOmniUrgentActions(token, { limit = 12 } = {}) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await omniFetch(token, `/api/omni/actions/urgent?limit=${encodeURIComponent(limit)}`);
      setActions(Array.isArray(data?.actions) ? data.actions : []);
    } catch (e) {
      setError(e.message);
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [token, limit]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { actions, loading, error, reload };
}

// Duplicate-contact clusters from GET /api/omni/contacts/duplicates (read-only
// detection, Wave 6a). Degrades to [] so the panel never breaks pre-migration.
export function useOmniDuplicateContacts(token) {
  const [clusters, setClusters] = useState([]);
  const [scanBounded, setScanBounded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await omniFetch(token, "/api/omni/contacts/duplicates");
      setClusters(Array.isArray(data?.clusters) ? data.clusters : []);
      setScanBounded(!!data?.scan_bounded);
    } catch (e) {
      setError(e.message);
      setClusters([]);
      setScanBounded(false);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { clusters, scanBounded, loading, error, reload };
}

// Merge two duplicate contacts (Wave 6b, admin-only on the backend). Not a
// hook — a one-shot action the caller awaits, then reloads its own list.
export async function mergeOmniContacts(token, fromId, intoId) {
  return omniFetch(token, "/api/omni/contacts/merge", {
    method: "POST",
    body: JSON.stringify({ from_id: fromId, into_id: intoId }),
  });
}

// Internal operator notes for a conversation (collaboration; never sent to the
// customer). Degrades to [] so the thread panel never breaks pre-migration.
export function useOmniNotes(token, conversationId) {
  const [notes, setNotes] = useState([]);

  const reload = useCallback(async () => {
    if (!token || !conversationId) return;
    try {
      const data = await omniFetch(token, `/api/omni/conversations/${conversationId}/notes`);
      setNotes(data.notes || []);
    } catch {
      setNotes([]);
    }
  }, [token, conversationId]);

  useEffect(() => {
    setNotes([]);
    reload();
  }, [reload]);

  const addNote = useCallback(
    async (body) => {
      const text = String(body || "").trim();
      if (!token || !conversationId || !text) return;
      await omniFetch(token, `/api/omni/conversations/${conversationId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: text }),
      });
      await reload();
    },
    [token, conversationId, reload],
  );

  return { notes, addNote, reload };
}

// Inline AI copilot for a thread — on-demand draft/summarize/extract/translate/
// rewrite. Non-mutating: returns text the operator chooses to use. Clears when
// switching conversations.
export function useOmniAssist(token, conversationId) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { action, text }
  const [error, setError] = useState(null);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [conversationId]);

  const assist = useCallback(
    async (action, { instruction, draft } = {}) => {
      if (!token || !conversationId || loading) return;
      setLoading(true);
      setError(null);
      try {
        const data = await omniFetch(
          token,
          `/api/omni/conversations/${conversationId}/assist`,
          { method: "POST", body: JSON.stringify({ action, instruction, draft }) },
        );
        setResult({ action, text: data.result || "" });
      } catch (e) {
        setError(e.data?.error || e.message || "assist_failed");
      } finally {
        setLoading(false);
      }
    },
    [token, conversationId, loading],
  );

  return { assist, loading, result, error, reset };
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

export function useOmniDeals(token, { stage, limit = 200 } = {}) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!token) {
      setDeals([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (stage) params.set("stage", stage);
      const data = await omniFetch(token, `/api/omni/deals?${params}`);
      setDeals(data.deals || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, stage, limit]);

  useEffect(() => {
    reload();
  }, [reload]);

  const moveDeal = useCallback(
    async (dealId, nextStage) => {
      const data = await omniFetch(token, `/api/omni/deals/${dealId}/stage`, {
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
