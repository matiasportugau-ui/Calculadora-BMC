/**
 * useDictation — one-shot mic-to-text via /api/agent/transcribe (Whisper).
 *
 * Different from useVoiceSession (which is a fluent two-way realtime voice
 * agent over WebRTC). This hook is the lighter dictation path: user clicks
 * mic, speaks, clicks again to stop, transcript comes back as text — the
 * caller decides what to do with the text (typically: insert into the
 * chat input box and let the user review/edit before sending).
 *
 * Lifecycle:
 *   idle → recording → transcribing → idle (with transcript callback fired)
 *                                    ↘ error
 *
 * Browser support: MediaRecorder is in all modern browsers including Safari
 * 14+. Falls back gracefully if mic permission is denied.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";

const API_BASE = getCalcApiBase();

/**
 * @param {object} opts
 * @param {(text: string) => void} opts.onTranscript     fired once with the final transcript
 * @param {(err: string) => void}   [opts.onError]       fired on mic / network / Whisper error
 * @param {string}                  [opts.language="es"] ISO-639-1 hint passed to Whisper
 * @param {number}                  [opts.maxSeconds=60] hard stop after this many seconds (cost guard)
 */
export function useDictation({ onTranscript, onError, language = "es", maxSeconds = 60 } = {}) {
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
  // Forward-ref to stop() so start()'s maxSeconds timeout can call it without
  // a use-before-declaration cycle (start is declared first because callers
  // read it more often).
  const stopRef = useRef(null);

  const cleanup = useCallback(() => {
    if (vuRafRef.current) {
      cancelAnimationFrame(vuRafRef.current);
      vuRafRef.current = null;
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
    recorderRef.current = null;
    chunksRef.current = [];
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

  const start = useCallback(async () => {
    if (status !== "idle") return;
    setError(null);

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

    // Pick the best supported MIME type (Safari prefers mp4; Chrome/Firefox webm/opus).
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

    // Hard stop after maxSeconds — cost / runaway guard. Indirect via stopRef
    // so we don't take a circular dep on stop()'s declaration order.
    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        stopRef.current?.();
      }
    }, Math.max(1, maxSeconds) * 1000);
  }, [status, onError, maxSeconds, startVu, cleanup]);

  const stop = useCallback(async () => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== "recording") return;

    setStatus("transcribing");
    if (vuRafRef.current) {
      cancelAnimationFrame(vuRafRef.current);
      vuRafRef.current = null;
    }
    setVuLevel(0);

    // Wait for recorder to flush final chunk
    await new Promise((resolve) => {
      const onStop = () => {
        rec.removeEventListener("stop", onStop);
        resolve();
      };
      rec.addEventListener("stop", onStop);
      rec.stop();
    });

    // Release mic before the network call so users see the "transcribing" state
    // without the indicator showing the page still has mic access.
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

  // Keep stopRef in sync so the maxSeconds setTimeout in start() can call stop()
  // without a use-before-declared cycle.
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
