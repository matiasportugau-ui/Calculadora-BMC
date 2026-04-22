/**
 * useVoiceSession — WebRTC lifecycle for OpenAI Realtime API voice mode.
 *
 * Flow:
 *   1. POST /api/agent/voice/session → ephemeral client_secret
 *   2. Create RTCPeerConnection; add mic audio track
 *   3. Create data channel for events (function calls, transcripts)
 *   4. Create SDP offer → POST to OpenAI Realtime with ephemeral token → apply answer
 *   5. On function_call events, relay to POST /api/agent/voice/action and call onAction
 *   6. Expose transcript deltas via onTranscriptDelta callback
 */

import { useState, useRef, useCallback } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";

const API_BASE = getCalcApiBase();

const OPENAI_REALTIME_BASE = "https://api.openai.com/v1/realtime";

export function useVoiceSession({ onAction, onTranscriptDelta, onError, devMode = false, authHeader }) {
  const [status, setStatus] = useState("idle"); // idle | connecting | active | error
  const [isSpeaking, setIsSpeaking] = useState(false); // assistant is speaking
  const [isListening, setIsListening] = useState(false); // VAD detected user speech
  const [vuLevel, setVuLevel] = useState(0); // 0-1 for VU meter

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const audioElRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const vuRafRef = useRef(null);
  const sessionIdRef = useRef(null);
  const modelRef = useRef(null);

  const stopVu = useCallback(() => {
    if (vuRafRef.current) {
      cancelAnimationFrame(vuRafRef.current);
      vuRafRef.current = null;
    }
    setVuLevel(0);
  }, []);

  const startVu = useCallback((stream) => {
    try {
      const ctx = new AudioContext();
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
    } catch {
      // AudioContext not available (e.g. test env)
    }
  }, []);

  const handleDataChannelMessage = useCallback(
    async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      const type = msg?.type;

      if (type === "response.audio.delta") {
        setIsSpeaking(true);
      }
      if (type === "response.audio.done" || type === "response.done") {
        setIsSpeaking(false);
      }
      if (type === "input_audio_buffer.speech_started") {
        setIsListening(true);
      }
      if (type === "input_audio_buffer.speech_stopped") {
        setIsListening(false);
      }

      // Transcript deltas from the assistant
      if (type === "response.audio_transcript.delta") {
        onTranscriptDelta?.({ role: "assistant", delta: msg.delta || "" });
      }
      if (type === "conversation.item.input_audio_transcription.completed") {
        onTranscriptDelta?.({ role: "user", transcript: msg.transcript || "" });
      }

      // Function call handling
      if (type === "response.function_call_arguments.done") {
        const callId = msg.call_id;
        const fnName = msg.name;
        let args = {};
        try {
          args = JSON.parse(msg.arguments || "{}");
        } catch {
          args = {};
        }

        // Relay to server for validation + logging
        let validatedAction = { type: fnName, payload: args };
        try {
          const headers = { "Content-Type": "application/json" };
          if (authHeader) headers.Authorization = authHeader;
          const relayRes = await fetch(`${API_BASE}/api/agent/voice/action`, {
            method: "POST",
            headers,
            body: JSON.stringify({ action: { type: fnName, payload: args } }),
          });
          if (relayRes.ok) {
            const relayData = await relayRes.json();
            if (relayData.ok && relayData.action) {
              validatedAction = relayData.action;
            } else if (relayData.rejected) {
              // Send rejection back via data channel so agent can correct itself
              dcRef.current?.send(JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: callId,
                  output: JSON.stringify({ ok: false, errors: relayData.errors }),
                },
              }));
              dcRef.current?.send(JSON.stringify({ type: "response.create" }));
              return;
            }
          }
        } catch {
          // Non-fatal: apply the raw action anyway
        }

        // Apply the action via the calculator's handler
        onAction?.(validatedAction);

        // Acknowledge to OpenAI so the turn can continue
        dcRef.current?.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ ok: true }),
          },
        }));
        dcRef.current?.send(JSON.stringify({ type: "response.create" }));
      }
    },
    [onAction, onTranscriptDelta, authHeader]
  );

  const start = useCallback(
    async (calcState = {}) => {
      if (status === "connecting" || status === "active") return;
      setStatus("connecting");

      try {
        // 1. Mint ephemeral session token
        const headers = { "Content-Type": "application/json" };
        if (authHeader) headers.Authorization = authHeader;
        const sessRes = await fetch(`${API_BASE}/api/agent/voice/session`, {
          method: "POST",
          headers,
          body: JSON.stringify({ calcState, devMode }),
        });
        if (!sessRes.ok) {
          const err = await sessRes.json().catch(() => ({ error: "Error al iniciar sesión de voz" }));
          throw new Error(err.error || "Session mint failed");
        }
        const sessData = await sessRes.json();
        if (!sessData.ok || !sessData.client_secret) {
          throw new Error(sessData.error || "No client_secret received");
        }
        sessionIdRef.current = sessData.session_id;
        modelRef.current = sessData.model;

        const ephemeralKey = sessData.client_secret.value;

        // 2. Get mic stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        startVu(stream);

        // 3. Create peer connection
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // 4. Wire remote audio to a hidden <audio> element
        const audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);
        audioElRef.current = audioEl;
        pc.ontrack = (e) => {
          audioEl.srcObject = e.streams[0];
        };

        // 5. Add mic track
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        // 6. Data channel for function calls + events
        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        dc.onmessage = (e) => handleDataChannelMessage(e.data);
        dc.onopen = () => setStatus("active");
        dc.onclose = () => {
          setStatus("idle");
          setIsSpeaking(false);
          setIsListening(false);
          stopVu();
        };

        // 7. SDP negotiation
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpRes = await fetch(`${OPENAI_REALTIME_BASE}?model=${encodeURIComponent(modelRef.current)}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        });

        if (!sdpRes.ok) {
          throw new Error(`SDP negotiation failed: ${sdpRes.status}`);
        }

        const answerSdp = await sdpRes.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      } catch (err) {
        setStatus("error");
        setIsSpeaking(false);
        setIsListening(false);
        stopVu();
        onError?.(err.message || "Error de voz");
      }
    },
    [status, devMode, authHeader, startVu, stopVu, handleDataChannelMessage, onError]
  );

  const stop = useCallback(() => {
    stopVu();
    if (dcRef.current) {
      try { dcRef.current.close(); } catch { /* ignore */ }
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => s.track?.stop());
      try { pcRef.current.close(); } catch { /* ignore */ }
      pcRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current.remove();
      audioElRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    sessionIdRef.current = null;
    setStatus("idle");
    setIsSpeaking(false);
    setIsListening(false);
  }, [stopVu]);

  // Barge-in: user talks while assistant is speaking — just let audio flow;
  // OpenAI VAD handles it server-side. We can also send a cancel event:
  const interrupt = useCallback(() => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify({ type: "response.cancel" }));
    }
    setIsSpeaking(false);
  }, []);

  return { status, isSpeaking, isListening, vuLevel, start, stop, interrupt };
}
