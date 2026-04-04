import { useState, useRef, useCallback, useEffect } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import { mapErrorMessage } from "../utils/chatErrors.js";

const STORAGE_KEY = "panelin-chat-history";
const MAX_STORED = 40; // keep last 40 messages in localStorage

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
 * @returns {{ messages, isStreaming, send, stop, retry, clear, error }}
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
  const [devMeta, setDevMeta] = useState({ kbMatches: 0, calcValidation: null });
  const [trainingEntries, setTrainingEntries] = useState([]);
  const [trainingStats, setTrainingStats] = useState({ total: 0 });
  const [promptPreview, setPromptPreview] = useState("");
  const [promptSections, setPromptSections] = useState({});
  const abortRef = useRef(null);
  // Keep a ref to messages so send()/retry() closures see current history
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  // 1.2 — Track last user text for retry
  const lastUserTextRef = useRef("");

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
    [isStreaming, calcState, onAction, devMode, buildDevAuthHeaders]
  );

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
    async ({ category, question, badAnswer, goodAnswer, context }) => {
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
    [buildDevAuthHeaders, reloadTrainingKB]
  );

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
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return {
    messages,
    isStreaming,
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
  };
}
