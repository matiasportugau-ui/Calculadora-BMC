/**
 * Panelin Co-Work — screen / tab capture + Live assist frame buffer.
 * Spec: docs/team/SDD-PANELIN-COWORK.md (D3, ADR-003)
 *
 * Live assist captures every ~4s into a local buffer; frames attach on send only
 * (VITE_COWORK_LIVE_AUTOSEND must stay off by default).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  resolveLiveIntervalMs,
  isLiveAutosendEnabled,
  buildLiveAssistAttachment,
  sharedLiveFrameBuffer,
  LIVE_ASSIST_DEFAULT_INTERVAL_MS,
} from "./liveAssistCore.js";

const CONSENT_KEY = "panelin-cowork-consent-v1";
const DEFAULT_INTERVAL_MS = resolveLiveIntervalMs(
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_COWORK_LIVE_INTERVAL_MS : undefined,
);
const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.72;

// Autosend is intentionally not wired into the hook (ADR-003). Expose for tests/UI.
export const LIVE_AUTOSEND_DEFAULT_OFF = !isLiveAutosendEnabled(
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_COWORK_LIVE_AUTOSEND : "0",
);

function loadConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

function saveConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Grab one JPEG frame from a MediaStream track via video+canvas.
 * @param {MediaStream} stream
 * @param {string} [source]
 * @returns {Promise<{ mime: string, data: string, bytes: number, source: string, capturedAt: string }|null>}
 */
export async function captureFrameFromStream(stream, source = "oneshot") {
  if (!stream) return null;
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.srcObject = stream;
  await video.play().catch(() => {});
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  let w = video.videoWidth || 0;
  let h = video.videoHeight || 0;
  if (!w || !h) {
    video.srcObject = null;
    return null;
  }
  if (w > MAX_WIDTH) {
    h = Math.round((h * MAX_WIDTH) / w);
    w = MAX_WIDTH;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    video.srcObject = null;
    return null;
  }
  ctx.drawImage(video, 0, 0, w, h);
  video.pause();
  video.srcObject = null;

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const data = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
  const bytes = Math.floor((data.length * 3) / 4);
  return {
    type: "image",
    mime: "image/jpeg",
    data,
    bytes,
    source,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * @param {{ enabled?: boolean, useSharedBuffer?: boolean }} opts
 */
export function useScreenCoWork(opts = {}) {
  const enabled = opts.enabled !== false;
  const useShared = opts.useSharedBuffer !== false;
  const [consent, setConsent] = useState(loadConsent);
  const [sharing, setSharing] = useState(false);
  const [liveAssist, setLiveAssist] = useState(false);
  const [lastFrame, setLastFrame] = useState(null);
  const [error, setError] = useState(null);
  const [thumbUrl, setThumbUrl] = useState(null);

  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const liveAssistRef = useRef(false);
  const intervalMsRef = useRef(DEFAULT_INTERVAL_MS || LIVE_ASSIST_DEFAULT_INTERVAL_MS);

  const applyFrameToState = useCallback((frame, { live = false } = {}) => {
    if (!frame) return;
    setLastFrame(frame);
    setThumbUrl(`data:image/jpeg;base64,${frame.data}`);
    if (useShared) {
      if (live || frame.source === "live_assist") {
        sharedLiveFrameBuffer.writeLiveFrame(frame);
      } else {
        sharedLiveFrameBuffer.writeFrame(frame, frame.source || "oneshot");
      }
    }
  }, [useShared]);

  const stopTracks = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    setSharing(false);
    setLiveAssist(false);
    liveAssistRef.current = false;
    if (useShared) sharedLiveFrameBuffer.stop();
  }, [useShared]);

  const acceptConsent = useCallback(() => {
    saveConsent();
    setConsent(true);
  }, []);

  const startShare = useCallback(async () => {
    setError(null);
    if (!enabled) {
      setError("Co-Work deshabilitado");
      return null;
    }
    if (!navigator?.mediaDevices?.getDisplayMedia) {
      setError("Tu navegador no soporta compartir pestaña. Podés pegar una captura.");
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: false,
        // @ts-expect-error — Chromium preferCurrentTab
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      });
      streamRef.current = stream;
      setSharing(true);
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.addEventListener("ended", () => {
          stopTracks();
        });
      }
      return stream;
    } catch (err) {
      const msg = err?.name === "NotAllowedError"
        ? "No se compartió la pestaña (cancelado o denegado)."
        : err?.message || "No se pudo compartir pantalla";
      setError(msg);
      return null;
    }
  }, [enabled, stopTracks]);

  const grabFrame = useCallback(async (source = "oneshot") => {
    setError(null);
    let stream = streamRef.current;
    if (!stream) {
      stream = await startShare();
      if (!stream) return null;
    }
    try {
      const frame = await captureFrameFromStream(stream, source);
      if (!frame) {
        setError("No se pudo capturar el frame");
        return null;
      }
      applyFrameToState(frame, { live: source === "live_assist" });
      // One-shot without live: stop tracks after capture to free the share indicator
      if (source === "oneshot" && !liveAssistRef.current) {
        stopTracks();
      }
      return frame;
    } catch (err) {
      setError(err?.message || "Error capturando frame");
      return null;
    }
  }, [startShare, stopTracks, applyFrameToState]);

  const oneShotCapture = useCallback(async () => {
    if (!consent) acceptConsent();
    return grabFrame("oneshot");
  }, [consent, acceptConsent, grabFrame]);

  const startLiveInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const ms = intervalMsRef.current;
    intervalRef.current = setInterval(() => {
      if (!liveAssistRef.current || !streamRef.current) return;
      // ADR-003: only buffer locally — never POST from this interval unless autosend
      // is explicitly enabled (default OFF; not implemented as auto-POST).
      captureFrameFromStream(streamRef.current, "live_assist")
        .then((frame) => {
          if (!frame || !liveAssistRef.current) return;
          applyFrameToState(frame, { live: true });
        })
        .catch(() => {});
    }, ms);
  }, [applyFrameToState]);

  const setLiveAssistOn = useCallback(async (on) => {
    setError(null);
    if (!on) {
      liveAssistRef.current = false;
      setLiveAssist(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (useShared) sharedLiveFrameBuffer.setLiveOn(false);
      // Stop share tracks when Live turns OFF (SDD: clean stop)
      stopTracks();
      return;
    }
    if (!consent) acceptConsent();
    let stream = streamRef.current;
    if (!stream) {
      stream = await startShare();
      if (!stream) return;
    }
    liveAssistRef.current = true;
    setLiveAssist(true);
    if (useShared) sharedLiveFrameBuffer.setLiveOn(true);
    // Immediate frame into buffer
    await grabFrame("live_assist");
    startLiveInterval();
  }, [consent, acceptConsent, startShare, grabFrame, stopTracks, startLiveInterval, useShared]);

  /**
   * Consume buffer for chat send (does not clear live stream or stop interval).
   * When Live is ON, source is forced to live_assist.
   */
  const consumeFrameForSend = useCallback(() => {
    const live = liveAssistRef.current || liveAssist;
    // Prefer local state; fall back to shared buffer (Admin → Panelin D2)
    const local = buildLiveAssistAttachment(lastFrame, { liveAssist: live });
    if (local) return local;
    if (useShared) {
      if (live) sharedLiveFrameBuffer.setLiveOn(true);
      return sharedLiveFrameBuffer.consumeForSend();
    }
    return null;
  }, [lastFrame, liveAssist, useShared]);

  const clearFrame = useCallback(() => {
    setLastFrame(null);
    setThumbUrl(null);
    if (useShared) sharedLiveFrameBuffer.clear();
  }, [useShared]);

  // Cleanup on unmount
  useEffect(() => () => stopTracks(), [stopTracks]);

  // Pause interval when tab hidden; resume when visible if Live still ON
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (liveAssistRef.current && streamRef.current && !intervalRef.current) {
        startLiveInterval();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [startLiveInterval]);

  return {
    enabled,
    consent,
    acceptConsent,
    sharing,
    liveAssist,
    lastFrame,
    thumbUrl,
    error,
    clearError: () => setError(null),
    oneShotCapture,
    setLiveAssistOn,
    stopShare: stopTracks,
    consumeFrameForSend,
    clearFrame,
    /** Interval ms currently used (for UI/tests) */
    liveIntervalMs: intervalMsRef.current,
    /** ADR-003: autosend is off */
    liveAutosendEnabled: !LIVE_AUTOSEND_DEFAULT_OFF,
  };
}

// Re-export pure helpers for tests / other modules
export {
  resolveLiveIntervalMs,
  isLiveAutosendEnabled,
  buildLiveAssistAttachment,
  sharedLiveFrameBuffer,
  LIVE_ASSIST_DEFAULT_INTERVAL_MS,
} from "./liveAssistCore.js";
