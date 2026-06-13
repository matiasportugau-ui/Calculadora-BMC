/**
 * useDictation — one-shot mic-to-text for the chat input.
 *
 * Two backends, transparent to the caller:
 *   1. Browser-native SpeechRecognition (Web Speech API) — PRIMARY when the
 *      browser supports it (Chrome/Edge, and Safari via webkit). Free, no API
 *      key, no server round-trip. This is what makes voice work even when the
 *      server-side Whisper key is missing or out of quota.
 *   2. MediaRecorder → POST /api/agent/transcribe (OpenAI Whisper) — FALLBACK
 *      for browsers without SpeechRecognition (e.g. Firefox).
 *
 * Same external contract regardless of backend:
 *   idle → recording → (transcribing) → idle  (onTranscript fired)
 *                                      ↘ error
 *
 * The caller inserts the returned text into the chat input for review/edit.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";

const API_BASE = getCalcApiBase();

/** Resolve the browser SpeechRecognition constructor, if any. */
export function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/** Map an ISO-639-1 hint to a BCP-47 tag the browser engine accepts. */
export function toBrowserLang(language) {
  const l = String(language || "es").toLowerCase();
  if (l === "es" || l.startsWith("es-")) return l === "es" ? "es-419" : language;
  return language;
}

/**
 * @param {object} opts
 * @param {(text: string) => void} opts.onTranscript     fired once with the final transcript
 * @param {(err: string) => void}   [opts.onError]       fired on mic / network / transcribe error
 * @param {string}                  [opts.language="es"] ISO-639-1 hint
 * @param {number}                  [opts.maxSeconds=60] hard stop after this many seconds (cost guard)
 * @param {boolean}                 [opts.preferBrowserSpeech=true] use Web Speech API when available
 */
export function useDictation({
  onTranscript,
  onError,
  language = "es",
  maxSeconds = 60,
  preferBrowserSpeech = true,
} = {}) {
  const [status, setStatus] = useState("idle"); // idle | recording | transcribing | error
  const [error, setError] = useState(null);
  const [vuLevel, setVuLevel] = useState(0); // 0–1 visual feedback

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const vuRafRef = useRef(null);
  const mimeRef = useRef("audio/webm");
  const stopRef = useRef(null);
  // Backend in use for the current session: "browser" | "whisper" | null.
  const modeRef = useRef(null);
  const srRef = useRef(null);
  const pulseTimerRef = useRef(null);

  const cleanup = useCallback(() => {
    if (vuRafRef.current) {
      cancelAnimationFrame(vuRafRef.current);
      vuRafRef.current = null;
    }
    if (pulseTimerRef.current) {
      clearInterval(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
    setVuLevel(0);
    try { audioCtxRef.current?.close(); } catch { /* ignore */ }
    audioCtxRef.current = null;
    analyserRef.current = null;
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      streamRef.current = null;
    }
    if (srRef.current) {
      try { srRef.current.abort(); } catch { /* ignore */ }
      srRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    modeRef.current = null;
  }, []);

  // Auto-cleanup on unmount
  useEffect(() => () => cleanup(), [cleanup]);

  const startVu = useCallback((stream) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
        setVuLevel(Math.min(1, avg / 80));
        vuRafRef.current = requestAnimationFrame(tick);
      };
      vuRafRef.current = requestAnimationFrame(tick);
    } catch { /* VU is decorative — ignore */ }
  }, []);

  // ── Backend 1: browser-native SpeechRecognition ────────────────────────────
  const startBrowserSpeech = useCallback((SR) => {
    let rec;
    try {
      rec = new SR();
    } catch {
      return false; // construction failed → caller falls back to Whisper
    }
    rec.lang = toBrowserLang(language);
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let gotResult = false;
    rec.onresult = (e) => {
      gotResult = true;
      const text = Array.from(e.results)
        .map((r) => r[0]?.transcript || "")
        .join(" ")
        .trim();
      onTranscript?.(text);
      setStatus("idle");
      cleanup();
    };
    rec.onerror = (e) => {
      // no-speech / aborted are benign — return to idle without a scary error.
      if (e?.error === "no-speech" || e?.error === "aborted") {
        setStatus("idle");
        cleanup();
        return;
      }
      const msg =
        e?.error === "not-allowed" || e?.error === "service-not-allowed"
          ? "Permiso de micrófono denegado. Habilitá el micrófono en tu navegador."
          : `Dictado por voz falló: ${e?.error || "desconocido"}`;
      setError(msg);
      onError?.(msg);
      setStatus("error");
      cleanup();
    };
    rec.onend = () => {
      // Safety net: if it ended with no result and we're stuck in recording/transcribing, reset.
      if (!gotResult) {
        setStatus((s) => (s === "recording" || s === "transcribing" ? "idle" : s));
        cleanup();
      }
    };

    try {
      rec.start();
    } catch {
      return false;
    }
    srRef.current = rec;
    modeRef.current = "browser";
    setStatus("recording");

    // Soft VU pulse so the UI shows activity (no mic-level access in this mode).
    let t = 0;
    pulseTimerRef.current = setInterval(() => {
      t += 0.25;
      setVuLevel(0.35 + 0.25 * Math.abs(Math.sin(t)));
    }, 120);

    // Cost / runaway guard.
    stopTimerRef.current = setTimeout(() => {
      stopRef.current?.();
    }, Math.max(1, maxSeconds) * 1000);
    return true;
  }, [language, maxSeconds, onTranscript, onError, cleanup]);

  // ── Backend 2: MediaRecorder → Whisper ─────────────────────────────────────
  const startWhisper = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      const msg = "Tu navegador no soporta dictado por voz. Probá con Chrome o Edge.";
      setError(msg);
      onError?.(msg);
      setStatus("error");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const msg = err?.name === "NotAllowedError"
        ? "Permiso de micrófono denegado. Habilitá el micrófono en tu navegador."
        : `No se pudo acceder al micrófono: ${err?.message || err}`;
      setError(msg);
      onError?.(msg);
      setStatus("error");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    modeRef.current = "whisper";

    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    let chosenMime = "";
    for (const m of candidates) {
      if (window.MediaRecorder.isTypeSupported?.(m)) {
        chosenMime = m;
        break;
      }
    }
    mimeRef.current = chosenMime || "audio/webm";

    let recorder;
    try {
      recorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);
    } catch (err) {
      cleanup();
      const msg = `No se pudo iniciar el grabador: ${err?.message || err}`;
      setError(msg);
      onError?.(msg);
      setStatus("error");
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onerror = (e) => {
      const msg = `Error del grabador: ${e?.error?.message || "unknown"}`;
      setError(msg);
      onError?.(msg);
      setStatus("error");
      cleanup();
    };

    recorder.start();
    recorderRef.current = recorder;
    startVu(stream);
    setStatus("recording");

    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        stopRef.current?.();
      }
    }, Math.max(1, maxSeconds) * 1000);
  }, [onError, maxSeconds, startVu, cleanup]);

  const start = useCallback(async () => {
    if (status !== "idle") return;
    setError(null);

    // Prefer the free, key-less browser engine when available.
    if (preferBrowserSpeech) {
      const SR = getSpeechRecognition();
      if (SR && startBrowserSpeech(SR)) return;
    }
    await startWhisper();
  }, [status, preferBrowserSpeech, startBrowserSpeech, startWhisper]);

  const stop = useCallback(async () => {
    // Browser engine: stop() lets it flush a final onresult, then onend.
    if (modeRef.current === "browser") {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      if (pulseTimerRef.current) {
        clearInterval(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
      setStatus("transcribing");
      try { srRef.current?.stop(); } catch { /* ignore */ }
      return;
    }

    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;

    setStatus("transcribing");
    if (vuRafRef.current) {
      cancelAnimationFrame(vuRafRef.current);
      vuRafRef.current = null;
    }
    setVuLevel(0);

    await new Promise((resolve) => {
      const onStop = () => {
        rec.removeEventListener("stop", onStop);
        resolve();
      };
      rec.addEventListener("stop", onStop);
      rec.stop();
    });

    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      streamRef.current = null;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    const chunks = chunksRef.current;
    chunksRef.current = [];
    const blob = new Blob(chunks, { type: mimeRef.current });

    if (blob.size < 1024) {
      const msg = "Audio demasiado corto. Mantené el botón presionado más tiempo.";
      setError(msg);
      onError?.(msg);
      setStatus("error");
      cleanup();
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/api/agent/transcribe?language=${encodeURIComponent(language)}`, {
        method: "POST",
        headers: { "Content-Type": mimeRef.current.split(";")[0] },
        body: blob,
      });
      const data = await resp.json().catch(() => ({ ok: false, error: `HTTP ${resp.status}` }));
      if (!resp.ok || !data.ok) {
        const msg = data.error || `Transcripción falló (HTTP ${resp.status})`;
        setError(msg);
        onError?.(msg);
        setStatus("error");
        cleanup();
        return;
      }
      onTranscript?.(String(data.text || ""));
      setStatus("idle");
      cleanup();
    } catch (err) {
      const msg = err?.message || "Error de red al transcribir";
      setError(msg);
      onError?.(msg);
      setStatus("error");
      cleanup();
    }
  }, [language, onTranscript, onError, cleanup]);

  // Keep stopRef in sync so the maxSeconds timeout can call the latest stop().
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const reset = useCallback(() => {
    setError(null);
    setStatus("idle");
    cleanup();
  }, [cleanup]);

  return { status, error, vuLevel, start, stop, reset };
}
