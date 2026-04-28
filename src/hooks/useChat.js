import { useState, useRef, useCallback, useEffect } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import { mapErrorMessage } from "../utils/chatErrors.js";

const STORAGE_KEY = "panelin-chat-history";
const STORAGE_AI = "panelin-chat-ai-selection-v1";
const STORAGE_CONV_ID = "panelin-conversation-id";
const ALLOWED_AI_PROVIDERS = new Set(["claude", "openai", "grok", "gemini"]);
const MAX_STORED = 40; // keep last 40 messages in localStorage

function loadConversationId() {
  try {
    return sessionStorage.getItem(STORAGE_CONV_ID) || null;
  } catch { return null; }
}

function saveConversationId(id) {
  try { sessionStorage.setItem(STORAGE_CONV_ID, id); } catch { /* ignore */ }
}

function fallbackUuidV4() {
  const bytes = new Uint8Array(16);
  try { globalThis.crypto?.getRandomValues?.(bytes); } catch {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function freshConversationId() {
  let id;
  try { id = globalThis.crypto?.randomUUID?.(); } catch { id = null; }
  if (!id) id = fallbackUuidV4();
  saveConversationId(id);
  return id;
}

function loadAiSelection() {
  try {
    const raw = typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_AI);
    if (!raw) return { aiProvider: "auto", aiModel: "" };
    const o = JSON.parse(raw);
    const aiProvider = o?.aiProvider === "claude" || o?.aiProvider === "openai" || o?.aiProvider === "grok" || o?.aiProvider === "gemini"
      ? o.aiProvider
      : "auto";
    const aiModel = typeof o?.aiModel === "string" ? o.aiModel : "";
    return { aiProvider, aiModel };
  } catch {
    return { aiProvider: "auto", aiModel: "" };
  }
}

function saveAiSelection(sel) {
  try {
    localStorage.setItem(STORAGE_AI, JSON.stringify(sel));
  } catch {
    // ignore
  }
}

function loadHistory() {
  try {
    const raw = typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(messages) {
  try {
    const toSave = messages.slice(-MAX_STORED).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      actions: m.actions,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // storage quota or SSR — ignore
  }
}


/**
 * Manages Panelin chat state and SSE streaming.
 *
 * @param {{
 *   calcState: object,
 *   onAction: (action: {type:string, payload:any}) => void,
 *   devMode?: boolean,
 *   devAuthToken?: string,
 *   persistHistory?: boolean,
 * }} opts
 * @returns {{ messages, isStreaming, aiProvider, aiModel, setAiProvider, setAiModel, setAiSelection, aiOptions, aiOptionsError, send, stop, retry, clear, error, ... }}
 */
export function useChat({
  calcState,
  onAction,
  devMode = false,
  devAuthToken = "",
  persistHistory = false,
}) {
  const [messages, setMessages] = useState(() => (persistHistory ? loadHistory() : []));
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [conversationId, setConversationId] = useState(() => loadConversationId() || freshConversationId());
  const [devMeta, setDevMeta] = useState({ kbMatches: 0, calcValidation: null });
  const [trainingEntries, setTrainingEntries] = useState([]);
  const [trainingStats, setTrainingStats] = useState({ total: 0 });
  const [promptPreview, setPromptPreview] = useState("");
  const [promptSections, setPromptSections] = useState({});
  const [{ aiProvider, aiModel }, setAiSelectionState] = useState(loadAiSelection);
  const [aiOptions, setAiOptions] = useState(null);
  const [aiOptionsError, setAiOptionsError] = useState(null);
  const abortRef = useRef(null);
  // Keep a ref to messages so send()/retry() closures see current history
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const aiSelectionRef = useRef({ aiProvider, aiModel });
  aiSelectionRef.current = { aiProvider, aiModel };
  // 1.2 — Track last user text for retry
  const lastUserTextRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const apiBase = getCalcApiBase();
        const res = await fetch(`${apiBase}/api/agent/ai-options`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setAiOptions(data);
          setAiOptionsError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setAiOptions(null);
          setAiOptionsError(e?.message || "ai-options");
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setAiProvider = useCallback((p) => {
    setAiSelectionState((prev) => {
      const next = {
        aiProvider: p,
        // New provider → use server default unless user picks a model again
        aiModel: p === "auto" || p !== prev.aiProvider ? "" : prev.aiModel,
      };
      saveAiSelection(next);
      return next;
    });
  }, []);

  const setAiModel = useCallback((m) => {
    setAiSelectionState((prev) => {
      const next = { ...prev, aiModel: typeof m === "string" ? m : "" };
      saveAiSelection(next);
      return next;
    });
  }, []);

  /** `auto` | `${provider}|` (default) | `${provider}|${modelId}` */
  const setAiPick = useCallback((pick) => {
    const raw = String(pick || "").trim();
    if (!raw || raw === "auto") {
      const next = { aiProvider: "auto", aiModel: "" };
      saveAiSelection(next);
      setAiSelectionState(next);
      return;
    }
    const pipe = raw.indexOf("|");
    const prov = pipe >= 0 ? raw.slice(0, pipe) : raw;
    const model = pipe >= 0 ? raw.slice(pipe + 1) : "";
    if (!ALLOWED_AI_PROVIDERS.has(prov)) {
      const next = { aiProvider: "auto", aiModel: "" };
      saveAiSelection(next);
      setAiSelectionState(next);
      return;
    }
    const next = { aiProvider: prov, aiModel: model };
    saveAiSelection(next);
    setAiSelectionState(next);
  }, []);

  // Persist history only when explicitly enabled.
  useEffect(() => {
    if (!persistHistory) return;
    if (messages.length > 0) saveHistory(messages);
  }, [messages, persistHistory]);

  // Default UX: every session starts clean (no previous conversation visible).
  useEffect(() => {
    if (persistHistory) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, [persistHistory]);

  // Auto-load dev panel data when devMode activates — no manual reload clicks needed
  const devAutoLoadedRef = useRef(false);
  useEffect(() => {
    if (!devMode || !devAuthToken) {
      devAutoLoadedRef.current = false;
      return;
    }
    if (devAutoLoadedRef.current) return;
    devAutoLoadedRef.current = true;
    Promise.all([
      reloadTrainingKB().catch(() => {}),
      reloadPromptSections().catch(() => {}),
      reloadPromptPreview().catch(() => {}),
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devMode, devAuthToken]);

  const buildDevAuthHeaders = useCallback(() => {
    if (!devMode || !devAuthToken) return {};
    return {
      Authorization: `Bearer ${devAuthToken}`,
      "X-Api-Key": devAuthToken,
    };
  }, [devMode, devAuthToken]);

  const send = useCallback(
    async (userText) => {
      if (isStreaming || !String(userText || "").trim()) return;
      lastUserTextRef.current = userText.trim();

      const userMsg = {
        id: crypto.randomUUID(),
        role: "user",
        content: userText.trim(),
      };
      const assistantId = crypto.randomUUID();
      const assistantMsg = {
        id: assistantId,
        role: "assistant",
        content: "",
        pending: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const apiBase = getCalcApiBase();
        const history = messagesRef.current;
        const headers = {
          "Content-Type": "application/json",
          ...buildDevAuthHeaders(),
        };

        const { aiProvider: ap, aiModel: am } = aiSelectionRef.current;
        const res = await fetch(`${apiBase}/api/agent/chat`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages: [...history, userMsg].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            calcState,
            devMode,
            aiProvider: ap,
            ...(ap !== "auto" && am ? { aiModel: am } : {}),
            conversationId,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = new Error(`HTTP ${res.status}`);
          err._status = res.status;
          throw err;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // SSE events are delimited by \n\n
          const parts = buf.split("\n\n");
          buf = parts.pop(); // keep incomplete tail

          for (const part of parts) {
            const dataLine = part
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            try {
              const evt = JSON.parse(dataLine.slice(6));
              if (evt.type === "text") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + evt.delta, pending: false }
                      : m
                  )
                );
              } else if (evt.type === "action") {
                onAction?.(evt.action);
                // Append a visual action-feedback entry into the last assistant message's actions list
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (!last || last.role !== "assistant") return prev;
                  const actions = [...(last.actions || []), evt.action];
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, actions } : m));
                });
              } else if (evt.type === "error") {
                setError(evt.message || "Error del agente");
              } else if (evt.type === "tool_call") {
                // Append a tool-call indicator to the assistant message (visible in dev mode)
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (!last || last.role !== "assistant") return prev;
                  const toolCalls = [...(last.toolCalls || []), { tool: evt.tool, input: evt.input }];
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, toolCalls } : m));
                });
              } else if (evt.type === "kb_match") {
                setDevMeta((prev) => ({ ...prev, kbMatches: Number(evt.count || 0) }));
              } else if (evt.type === "calc_validation") {
                setDevMeta((prev) => ({ ...prev, calcValidation: evt.validation || null }));
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (!last || last.role !== "assistant") return prev;
                  return prev.map((m, i) => (
                    i === prev.length - 1
                      ? { ...m, calcValidation: evt.validation || null }
                      : m
                  ));
                });
              }
              // type === "done" → loop exits naturally when reader closes
            } catch {
              // skip malformed event
            }
          }
        }
      } catch (err) {
        const msg = mapErrorMessage(err);
        if (msg) {
          setError(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "", pending: false }
                : m
            )
          );
        } else {
          // AbortError from stop() — keep partial content
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, pending: false } : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, calcState, onAction, devMode, buildDevAuthHeaders, conversationId]
  );

  const setAiSelection = useCallback((next) => {
    setAiSelectionState(() => {
      const merged = {
        aiProvider: next?.aiProvider === "claude" || next?.aiProvider === "openai" || next?.aiProvider === "grok" || next?.aiProvider === "gemini"
          ? next.aiProvider
          : "auto",
        aiModel: typeof next?.aiModel === "string" ? next.aiModel : "",
      };
      saveAiSelection(merged);
      return merged;
    });
  }, []);

  const reloadTrainingKB = useCallback(async () => {
    if (!devMode || !devAuthToken) return null;
    const apiBase = getCalcApiBase();
    const res = await fetch(`${apiBase}/api/agent/training-kb`, {
      method: "GET",
      headers: buildDevAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setTrainingEntries(data.entries || []);
    setTrainingStats(data.stats || { total: 0 });
    return data;
  }, [devMode, devAuthToken, buildDevAuthHeaders]);

  const saveCorrection = useCallback(
    async ({ category, question, badAnswer, goodAnswer, context, allowDuplicate = false, force = false }) => {
      // Duplicate detection before saving (skippable via allowDuplicate or force flag)
      if (!allowDuplicate && !force) {
        const normalQ = String(question || "").toLowerCase().trim();
        const duplicate = trainingEntries.find(
          (e) => String(e.question || "").toLowerCase().trim() === normalQ
        );
        if (duplicate) {
          return { ok: false, duplicate: true, existingId: duplicate.id };
        }
      }
      const apiBase = getCalcApiBase();
      const res = await fetch(`${apiBase}/api/agent/train`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildDevAuthHeaders(),
        },
        body: JSON.stringify({
          category,
          question,
          badAnswer,
          goodAnswer,
          context,
          source: "panelin-dev-mode",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      await reloadTrainingKB();
      return data;
    },
    [buildDevAuthHeaders, reloadTrainingKB, trainingEntries]
  );

  const sendFeedback = useCallback(async ({ question, generatedText, rating, correction, comment }) => {
    const apiBase = getCalcApiBase();
    try {
      await fetch(`${apiBase}/api/agent/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "chat", question, generatedText, rating, correction, comment, convId: conversationId }),
      });
    } catch { /* non-critical */ }
  }, [conversationId]);

  const bulkDeleteKB = useCallback(async (ids) => {
    if (!devMode || !devAuthToken || !Array.isArray(ids) || ids.length === 0) return null;
    const apiBase = getCalcApiBase();
    const res = await fetch(`${apiBase}/api/agent/train/bulk`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...buildDevAuthHeaders() },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await reloadTrainingKB();
    return res.json();
  }, [devMode, devAuthToken, buildDevAuthHeaders, reloadTrainingKB]);

  const bulkArchiveKB = useCallback(async (ids) => {
    if (!devMode || !devAuthToken || !Array.isArray(ids) || ids.length === 0) return null;
    const apiBase = getCalcApiBase();
    const res = await fetch(`${apiBase}/api/agent/train/bulk`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...buildDevAuthHeaders() },
      body: JSON.stringify({ ids, patch: { archived: true } }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await reloadTrainingKB();
    return res.json();
  }, [devMode, devAuthToken, buildDevAuthHeaders, reloadTrainingKB]);

  const loadConversationList = useCallback(async ({ days = 30, page = 1, limit = 20 } = {}) => {
    if (!devMode || !devAuthToken) return null;
    const apiBase = getCalcApiBase();
    const params = new URLSearchParams({ days, page, limit });
    const res = await fetch(`${apiBase}/api/agent/conversations?${params}`, {
      headers: buildDevAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, [devMode, devAuthToken, buildDevAuthHeaders]);

  const loadConversationAnalysis = useCallback(async (convId) => {
    if (!devMode || !devAuthToken || !convId) return null;
    const apiBase = getCalcApiBase();
    const res = await fetch(`${apiBase}/api/agent/conversations/${convId}/analysis`, {
      headers: buildDevAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, [devMode, devAuthToken, buildDevAuthHeaders]);

  const reloadPromptPreview = useCallback(async () => {
    if (!devMode || !devAuthToken) return null;
    const apiBase = getCalcApiBase();
    const q = [...messagesRef.current].reverse().find((m) => m.role === "user")?.content || "";
    const res = await fetch(`${apiBase}/api/agent/prompt-preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildDevAuthHeaders(),
      },
      body: JSON.stringify({ calcState, query: q }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setPromptPreview(data.prompt || "");
    return data;
  }, [devMode, devAuthToken, calcState, buildDevAuthHeaders]);

  const reloadPromptSections = useCallback(async () => {
    if (!devMode || !devAuthToken) return null;
    const apiBase = getCalcApiBase();
    const res = await fetch(`${apiBase}/api/agent/dev-config`, {
      method: "GET",
      headers: buildDevAuthHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setPromptSections(data.sections || {});
    return data;
  }, [devMode, devAuthToken, buildDevAuthHeaders]);

  const savePromptSection = useCallback(
    async ({ section, content }) => {
      const apiBase = getCalcApiBase();
      const res = await fetch(`${apiBase}/api/agent/dev-config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildDevAuthHeaders(),
        },
        body: JSON.stringify({ section, content }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      await reloadPromptSections();
      await reloadPromptPreview();
      return data;
    },
    [buildDevAuthHeaders, reloadPromptSections, reloadPromptPreview]
  );

  const verifyCalculation = useCallback(
    async (quoteText = "") => {
      const apiBase = getCalcApiBase();
      const res = await fetch(`${apiBase}/api/agent/training/log-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildDevAuthHeaders(),
        },
        body: JSON.stringify({
          type: "calc_verify_clicked",
          mode: "developer",
          quoteText: String(quoteText || "").slice(0, 1000),
          calcState,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [buildDevAuthHeaders, calcState]
  );

  // 1.3 — Stop generating without clearing history
  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // 1.2 — Retry last user message
  const retry = useCallback(() => {
    if (isStreaming || !lastUserTextRef.current) return;
    // Remove the last user+assistant pair before re-sending
    setMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => m.role === "user");
      if (idx === -1) return prev;
      return prev.slice(0, prev.length - idx - 1);
    });
    setError(null);
    // Use setTimeout to let state flush before re-sending
    setTimeout(() => send(lastUserTextRef.current), 0);
  }, [isStreaming, send]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
    lastUserTextRef.current = "";
    devAutoLoadedRef.current = false;
    const newId = freshConversationId();
    setConversationId(newId);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return {
    messages,
    isStreaming,
    aiProvider,
    aiModel,
    setAiProvider,
    setAiModel,
    setAiPick,
    setAiSelection,
    aiOptions,
    aiOptionsError,
    send,
    stop,
    retry,
    clear,
    error,
    devMeta,
    trainingEntries,
    trainingStats,
    promptPreview,
    promptSections,
    saveCorrection,
    reloadTrainingKB,
    reloadPromptPreview,
    reloadPromptSections,
    savePromptSection,
    verifyCalculation,
    bulkDeleteKB,
    bulkArchiveKB,
    loadConversationList,
    loadConversationAnalysis,
    conversationId,
    sendFeedback,
  };
}
