/**
 * voiceSupport — browser capability checks shared by PanelinVoicePanel
 * (embedded chat voice mode) and PanelinLivePage (/panelin/live).
 * WebRTC + OpenAI Realtime doesn't work reliably on Safari.
 */
export function isBrowserSupported() {
  if (typeof window === "undefined") return false;
  return !!(
    window.RTCPeerConnection &&
    navigator.mediaDevices?.getUserMedia &&
    (window.SpeechRecognition || window.webkitSpeechRecognition || true) // RTCPeerConnection is the real gate
  );
}

export function isSafari() {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}
