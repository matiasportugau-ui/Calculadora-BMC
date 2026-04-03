import { useState, useRef, useCallback, useEffect } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";

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
 * @param {{ calcState: object, onAction: (action: {type:string, payload:any}) => void }} opts
 * @returns {{ messages, isStreaming, send, clear, error }}
 */
export function useChat({ calcState, onAction }) {
  const [messages, setMessages] = useState(() => loadHistory());
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  // Keep a ref to messages so send() closures see current history
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Persist to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) saveHistory(messages);
  }, [messages]);

  const send = useCallback(
    async (userText) => {
      if (isStreaming || !String(userText || "").trim()) return;

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

        const res = await fetch(`${apiBase}/api/agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...history, userMsg].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            calcState,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
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
              }
              // type === "done" → loop exits naturally when reader closes
            } catch {
              // skip malformed event
            }
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("No se pudo conectar con Panelin. Intentá de nuevo.");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: "Lo siento, hubo un error. Intentá de nuevo.",
                    pending: false,
                  }
                : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, calcState, onAction]
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setIsStreaming(false);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return { messages, isStreaming, send, clear, error };
}
