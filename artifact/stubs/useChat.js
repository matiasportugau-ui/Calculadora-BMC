// Artifact stub for src/hooks/useChat.js
// The Panelin agent chat requires /api/agent/* endpoints which are unavailable
// inside a Claude Artifact sandbox. This stub returns the same shape as the
// real hook but every action is a no-op or a friendly "design-mode" notice.

import { useMemo, useState, useCallback } from "react";

const NOTICE = {
  role: "assistant",
  content:
    "Chat Panelin deshabilitado en el entorno de diseño (artifact). Para usar el agente real, abrí la app en https://calculadora-bmc.vercel.app.",
};

export function useChat() {
  const [messages] = useState([{ ...NOTICE, id: "artifact-notice" }]);
  const [conversationId] = useState("artifact-design");

  const noop = useCallback(() => {}, []);
  const asyncNoop = useCallback(async () => ({ ok: false, disabled: true }), []);

  return useMemo(
    () => ({
      messages,
      isStreaming: false,
      aiProvider: "auto",
      aiModel: "",
      setAiProvider: noop,
      setAiModel: noop,
      setAiPick: noop,
      setAiSelection: noop,
      aiOptions: [],
      aiOptionsError: null,
      relaxDevAuth: false,
      send: asyncNoop,
      stop: noop,
      retry: asyncNoop,
      clear: noop,
      error: null,
      devMeta: null,
      trainingEntries: [],
      trainingStats: null,
      promptPreview: "",
      promptSections: [],
      saveCorrection: asyncNoop,
      reloadTrainingKB: asyncNoop,
      reloadPromptPreview: asyncNoop,
      reloadPromptSections: asyncNoop,
      savePromptSection: asyncNoop,
      verifyCalculation: asyncNoop,
      bulkDeleteKB: asyncNoop,
      bulkArchiveKB: asyncNoop,
      loadConversationList: asyncNoop,
      loadConversationAnalysis: asyncNoop,
      conversationId,
      sendFeedback: asyncNoop,
      clearSuggestionsForMessage: noop,
    }),
    [messages, conversationId, noop, asyncNoop],
  );
}

export default useChat;
