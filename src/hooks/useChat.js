import { useState, useRef, useCallback } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";

/**
 * Manages Panelin chat state and SSE streaming.
 *
 * @param {{ calcState: object, onAction: (action: {type:string, payload:any}) => void }} opts
 * @returns {{ messages, isStreaming, send, clear, error }}
 */
export function useChat({ calcState, onAction }) {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  // Keep a ref to messages so send() closures see current history
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

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
  }, []);

  return { messages, isStreaming, send, clear, error };
}
