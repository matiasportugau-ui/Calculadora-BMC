/**
 * voiceSupport — browser capability checks shared by PanelinVoicePanel
 * (embedded chat hands-free voice) and PanelinLivePage (/panelin/live Realtime).
 *
 * Two paths exist:
 *   - Hands-free (embedded chat): Web Speech API — works on Safari/Chrome/Edge
 *   - Realtime (/panelin/live): WebRTC + OpenAI Realtime — Chrome/Edge only
 */

/** OpenAI Realtime / WebRTC path (PanelinLivePage). */
export function isBrowserSupported() {
  if (typeof window === "undefined") return false;
  return !!(window.RTCPeerConnection && navigator.mediaDevices?.getUserMedia);
}

/** Mic capture available (needed for Hands-free and Whisper fallback). */
export function canUseMic() {
  if (typeof navigator === "undefined") return false;
  return !!navigator.mediaDevices?.getUserMedia;
}

/** Hands-free wake-word path (PanelinVoicePanel / useHandsFreeVoice). */
export function isHandsFreeSupported() {
  if (typeof window === "undefined") return false;
  const hasSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  return hasSR && canUseMic();
}

/**
 * Firefox (and other browsers without Web Speech): push-to-talk via
 * POST /api/agent/transcribe (Whisper) when a mic is available.
 */
export function canUseWhisperVoice() {
  return canUseMic() && !isHandsFreeSupported();
}

export function isSafari() {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}
