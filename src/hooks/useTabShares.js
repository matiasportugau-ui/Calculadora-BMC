/**
 * Per-tab display capture. Chromium: several getDisplayMedia at once.
 * Cap LIVE_MAX concurrent live intervals.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { captureFrameFromStream } from "./useScreenCoWork.js";

export const LIVE_MAX = 3;
const INTERVAL_MS = 4000;

export function useTabShares() {
  const slotsRef = useRef(new Map());
  const [meta, setMeta] = useState({});

  const bump = useCallback((tabId, patch) => {
    setMeta((prev) => {
      const cur = prev[tabId] || {};
      return { ...prev, [tabId]: { ...cur, ...patch } };
    });
  }, []);

  const stopTab = useCallback((tabId) => {
    const slot = slotsRef.current.get(tabId);
    if (!slot) return;
    if (slot.interval) clearInterval(slot.interval);
    if (slot.stream) {
      for (const t of slot.stream.getTracks()) t.stop();
    }
    slotsRef.current.delete(tabId);
    bump(tabId, { live: false, sharing: false });
  }, [bump]);

  const liveCount = useCallback(
    () => [...slotsRef.current.values()].filter((s) => s.live).length,
    [],
  );

  const startShare = useCallback(async (tabId, opts = {}) => {
    if (!navigator?.mediaDevices?.getDisplayMedia) {
      bump(tabId, { error: "Este navegador no soporta compartir pestaña." });
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false,
        preferCurrentTab: !!opts.preferCurrentTab,
        selfBrowserSurface: "include",
      });
      const prev = slotsRef.current.get(tabId);
      if (prev?.stream) {
        for (const t of prev.stream.getTracks()) t.stop();
      }
      const slot = { stream, live: false, interval: null };
      slotsRef.current.set(tabId, slot);
      stream.getVideoTracks()[0]?.addEventListener("ended", () => stopTab(tabId));
      bump(tabId, { sharing: true, error: null });
      return stream;
    } catch (err) {
      bump(tabId, {
        error: err?.name === "NotAllowedError" ? "Captura cancelada." : (err?.message || "No se pudo compartir"),
      });
      return null;
    }
  }, [bump, stopTab]);

  const captureOnce = useCallback(async (tabId) => {
    let slot = slotsRef.current.get(tabId);
    let stream = slot?.stream;
    if (!stream) {
      stream = await startShare(tabId);
      if (!stream) return null;
      slot = slotsRef.current.get(tabId);
    }
    const frame = await captureFrameFromStream(stream, "oneshot");
    if (!frame) {
      bump(tabId, { error: "No se pudo capturar" });
      return null;
    }
    const thumbUrl = `data:image/jpeg;base64,${frame.data}`;
    if (slot) slot.lastFrame = frame;
    bump(tabId, { thumbUrl, capturedAt: frame.capturedAt, error: null });
    if (!slot?.live) {
      for (const t of stream.getTracks()) t.stop();
      if (slot) slot.stream = null;
      bump(tabId, { sharing: false });
    }
    return frame;
  }, [startShare, bump]);

  const setLive = useCallback(async (tabId, on, opts = {}) => {
    const slot = slotsRef.current.get(tabId);
    if (!on) {
      if (slot?.interval) clearInterval(slot.interval);
      if (slot) {
        slot.live = false;
        slot.interval = null;
        if (slot.stream) {
          for (const t of slot.stream.getTracks()) t.stop();
          slot.stream = null;
        }
      }
      bump(tabId, { live: false, sharing: false });
      return;
    }
    if (liveCount() >= LIVE_MAX && !slot?.live) {
      bump(tabId, { error: `Máximo ${LIVE_MAX} pantallas en vivo. Detené una primero.` });
      return;
    }
    let stream = slot?.stream;
    if (!stream) {
      stream = await startShare(tabId, opts);
      if (!stream) return;
    }
    const cur = slotsRef.current.get(tabId);
    if (!cur) return;
    cur.live = true;
    if (cur.interval) clearInterval(cur.interval);
    const grab = async () => {
      const s = slotsRef.current.get(tabId);
      if (!s?.live || !s.stream) return;
      const frame = await captureFrameFromStream(s.stream, "live_assist").catch(() => null);
      if (!frame || !slotsRef.current.get(tabId)?.live) return;
      s.lastFrame = frame;
      bump(tabId, { thumbUrl: `data:image/jpeg;base64,${frame.data}`, capturedAt: frame.capturedAt, live: true });
    };
    await grab();
    cur.interval = setInterval(grab, INTERVAL_MS);
    bump(tabId, { live: true, sharing: true, error: null });
  }, [startShare, bump, liveCount]);

  const consumeFocusedFrame = useCallback((tabId) => {
    return slotsRef.current.get(tabId)?.lastFrame || null;
  }, []);

  useEffect(() => () => {
    for (const id of [...slotsRef.current.keys()]) stopTab(id);
  }, [stopTab]);

  return { meta, captureOnce, setLive, stopTab, consumeFocusedFrame, liveCount, liveMax: LIVE_MAX };
}
