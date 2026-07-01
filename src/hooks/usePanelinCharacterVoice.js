/**
 * usePanelinCharacterVoice — composes useVoiceSession with the Panelin
 * character's emotion state, for the full-screen /panelin/live experience.
 *
 * Emotion is derived from signals useVoiceSession already exposes (no new
 * sentiment classifier for v1): connecting → thinking, user speaking →
 * listening, assistant speaking → speaking, a successful buildQuote action →
 * a transient "happy" pulse, otherwise neutral.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceSession } from "./useVoiceSession.js";

const HAPPY_DURATION_MS = 2500;

export function usePanelinCharacterVoice({ calcState, authHeader, devMode, onAction, onTranscriptDelta, onError } = {}) {
  const [isHappy, setIsHappy] = useState(false);
  const happyTimeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(happyTimeoutRef.current), []);

  const handleAction = useCallback(
    (action) => {
      if (action?.type === "buildQuote" && action?.rejected !== true) {
        setIsHappy(true);
        clearTimeout(happyTimeoutRef.current);
        happyTimeoutRef.current = setTimeout(() => setIsHappy(false), HAPPY_DURATION_MS);
      }
      onAction?.(action);
    },
    [onAction]
  );

  const voice = useVoiceSession({
    onAction: handleAction,
    onTranscriptDelta,
    onError,
    authHeader,
    devMode,
  });

  let emotion = "neutral";
  if (isHappy) {
    emotion = "happy";
  } else if (voice.status === "connecting") {
    emotion = "thinking";
  } else if (voice.isListening) {
    emotion = "listening";
  } else if (voice.isSpeaking) {
    emotion = "speaking";
  }

  const start = useCallback((overrideCalcState) => voice.start(overrideCalcState ?? calcState ?? {}), [voice, calcState]);

  return { ...voice, start, emotion };
}
