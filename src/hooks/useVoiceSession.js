/**
 * useVoiceSession — duplex voice for OpenAI Realtime (WebRTC/SDP) and
 * Grok Voice Agent (WebSocket PCM — xAI does not accept browser SDP POST).
 *
 * Flow (shared):
 *   1. POST /api/agent/voice/session → ephemeral client_secret + realtime_base
 *
 * OpenAI:
 *   2–7. RTCPeerConnection + SDP POST to realtime_base + data channel events
 *
 * Grok / xAI:
 *   2–7. WebSocket wss://api.x.ai/v1/realtime?model=…
 *        auth via subprotocol xai-client-secret.<token>
 *        mic → PCM16 base64 append; play output_audio deltas
 *        session.update from session_bootstrap
 *
 * Function calls → POST /api/agent/voice/action → onAction
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { getCalcApiBase } from "../utils/calcApiBase.js";
import {
  resolveSdpEndpoint,
  DEFAULT_REALTIME_SDP_BASE,
} from "../utils/resolveSdpEndpoint.js";
import {
  GROK_VOICE_SAMPLE_RATE,
  buildGrokRealtimeWsUrl,
  buildGrokWsProtocols,
  usesGrokWebSocketTransport,
  float32ToBase64Pcm16,
  base64Pcm16ToFloat32,
  resampleFloat32Linear,
  buildGrokSessionUpdate,
} from "../utils/grokRealtimeTransport.js";

const API_BASE = getCalcApiBase();
const DEFAULT_REALTIME_BASE = DEFAULT_REALTIME_SDP_BASE;

export function useVoiceSession({
  onAction,
  onTranscriptDelta,
  onError,
  onToolResult,
  onInputAudio,
  devMode = false,
  authHeader,
  leadContext = null,
  /** Preferred Realtime model (allowlisted server-side). */
  realtimeModel = null,
  aiProvider = "auto",
  aiModel = "",
  /** Optional override: "openai" | "grok" */
  voiceProvider = null,
  /** Supervised factory agent id (panelin default). */
  agentId = null,
  /** "agent" (talk) | "kernel" (mute observer). */
  kernelRole = "agent",
  /** "logistica" mints El Transportador pack (no calc tools). */
  surface = "",
  /** When false, do not capture mic (Kernel session is fed PCM). */
  captureMic = true,
  /** When true, keep the session but do not send mic PCM (operator mute). */
  micMuted = false,
  /** When false, skip playback of output PCM (Kernel silent unless wake). */
  playOutput = true,
  /** "voice" → /api/agent/voice/action ; "kernel" → /api/kernel/tool */
  relayKind = "voice",
}) {
  const [status, setStatus] = useState("idle"); // idle | connecting | active | error
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [vuLevel, setVuLevel] = useState(0);
  const [remoteVuLevel, setRemoteVuLevel] = useState(0);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const wsRef = useRef(null);
  const sendEventRef = useRef(null);
  const audioElRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const vuRafRef = useRef(null);
  const remoteAudioCtxRef = useRef(null);
  const remoteAnalyserRef = useRef(null);
  const remoteVuRafRef = useRef(null);
  const micStreamRef = useRef(null);
  const micProcessorRef = useRef(null);
  const micSourceRef = useRef(null);
  const playCtxRef = useRef(null);
  const playTimeRef = useRef(0);
  const sessionIdRef = useRef(null);
  const modelRef = useRef(null);
  const realtimeBaseRef = useRef(DEFAULT_REALTIME_BASE);
  const sessionBootstrapRef = useRef(null);
  const voiceProviderRef = useRef("openai");
  const stoppedRef = useRef(false);
  const calcStateRef = useRef({});
  const playOutputRef = useRef(playOutput);
  playOutputRef.current = playOutput;
  const onInputAudioRef = useRef(onInputAudio);
  onInputAudioRef.current = onInputAudio;
  const onToolResultRef = useRef(onToolResult);
  onToolResultRef.current = onToolResult;
  const agentIdRef = useRef(agentId);
  agentIdRef.current = agentId;
  const kernelRoleRef = useRef(kernelRole);
  kernelRoleRef.current = kernelRole;
  const relayKindRef = useRef(relayKind);
  relayKindRef.current = relayKind;
  const captureMicRef = useRef(captureMic);
  captureMicRef.current = captureMic;
  const micMutedRef = useRef(micMuted);
  micMutedRef.current = micMuted;

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

  const stopRemoteVu = useCallback(() => {
    if (remoteVuRafRef.current) {
      cancelAnimationFrame(remoteVuRafRef.current);
      remoteVuRafRef.current = null;
    }
    setRemoteVuLevel(0);
  }, []);

  const startRemoteVu = useCallback((remoteStream) => {
    try {
      const ctx = new AudioContext();
      remoteAudioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(remoteStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      remoteAnalyserRef.current = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
        setRemoteVuLevel(Math.min(1, avg / 80));
        remoteVuRafRef.current = requestAnimationFrame(tick);
      };
      remoteVuRafRef.current = requestAnimationFrame(tick);
    } catch {
      // ignore
    }
  }, []);

  const sendEvent = useCallback((payload) => {
    const fn = sendEventRef.current;
    if (typeof fn === "function") {
      try {
        fn(payload);
      } catch (err) {
        if (devMode) console.warn("[voice] sendEvent failed", err?.message);
      }
      return;
    }
    // OpenAI data channel
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(typeof payload === "string" ? payload : JSON.stringify(payload));
    }
  }, [devMode]);

  const playPcm16Base64 = useCallback((b64) => {
    try {
      const float32 = base64Pcm16ToFloat32(b64);
      if (!float32.length) return;
      let ctx = playCtxRef.current;
      if (!ctx || ctx.state === "closed") {
        ctx = new AudioContext({ sampleRate: GROK_VOICE_SAMPLE_RATE });
        playCtxRef.current = ctx;
        playTimeRef.current = 0;
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const buf = ctx.createBuffer(1, float32.length, GROK_VOICE_SAMPLE_RATE);
      buf.copyToChannel(float32, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      // Simple VU from RMS of chunk
      let sum = 0;
      for (let i = 0; i < float32.length; i++) sum += float32[i] * float32[i];
      const rms = Math.sqrt(sum / float32.length);
      setRemoteVuLevel(Math.min(1, rms * 4));
      src.connect(ctx.destination);
      const now = ctx.currentTime;
      const startAt = Math.max(now + 0.02, playTimeRef.current || now);
      src.start(startAt);
      playTimeRef.current = startAt + buf.duration;
    } catch (err) {
      if (devMode) console.warn("[voice] playPcm failed", err?.message);
    }
  }, [devMode]);

  const handleRealtimeEvent = useCallback(
    async (raw) => {
      let msg;
      try {
        msg = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (err) {
        if (devMode) console.warn("[voice] dropped malformed message", err?.message);
        return;
      }

      const type = msg?.type;

      if (
        type === "response.audio.delta" ||
        type === "response.output_audio.delta"
      ) {
        setIsSpeaking(true);
        if (msg.delta && playOutputRef.current) playPcm16Base64(msg.delta);
      }
      if (
        type === "response.audio.done" ||
        type === "response.output_audio.done" ||
        type === "response.done"
      ) {
        setIsSpeaking(false);
        setRemoteVuLevel(0);
      }
      if (type === "input_audio_buffer.speech_started") {
        setIsListening(true);
      }
      if (type === "input_audio_buffer.speech_stopped") {
        setIsListening(false);
      }

      if (
        type === "response.audio_transcript.delta" ||
        type === "response.output_audio_transcript.delta"
      ) {
        onTranscriptDelta?.({ role: "assistant", delta: msg.delta || "" });
      }
      if (type === "conversation.item.input_audio_transcription.completed") {
        onTranscriptDelta?.({ role: "user", transcript: msg.transcript || "" });
      }

      if (type === "error") {
        const errMsg =
          msg.error?.message || msg.message || "Error de sesión de voz (provider)";
        if (devMode) console.warn("[voice] provider error event", msg);
        onError?.(errMsg);
      }

      if (type === "response.function_call_arguments.done") {
        const callId = msg.call_id;
        const fnName = msg.name;
        let args = {};
        try {
          args = JSON.parse(msg.arguments || "{}");
        } catch (err) {
          console.warn(
            `[voice] could not parse arguments for ${fnName}, applying empty payload`,
            err?.message,
          );
          args = {};
        }

        let validatedAction = { type: fnName, payload: args };
        let toolOutput = JSON.stringify({ ok: true });
        try {
          const headers = { "Content-Type": "application/json" };
          if (authHeader) headers.Authorization = authHeader;
          const kernelRelay = relayKindRef.current === "kernel";
          const relayUrl = kernelRelay
            ? `${API_BASE}/api/kernel/tool`
            : `${API_BASE}/api/agent/voice/action`;
          const relayBody = kernelRelay
            ? { name: fnName, arguments: args }
            : {
                action: { type: fnName, payload: args },
                calcState: calcStateRef.current || {},
              };
          const relayRes = await fetch(relayUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(relayBody),
          });
          if (relayRes.ok) {
            const relayData = await relayRes.json();
            if (relayData.kind === "tool" || relayData.result != null) {
              toolOutput = typeof relayData.result === "string"
                ? relayData.result
                : JSON.stringify(relayData.result ?? { ok: true });
              onToolResultRef.current?.(fnName, relayData.result ?? relayData);
              if (Array.isArray(relayData.actions)) {
                for (const a of relayData.actions) {
                  if (a?.type) onAction?.(a);
                }
              }
              sendEvent({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: callId,
                  output: toolOutput,
                },
              });
              sendEvent({ type: "response.create" });
              return;
            }
            if (relayData.ok && relayData.action) {
              validatedAction = relayData.action;
            } else if (relayData.rejected) {
              sendEvent({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: callId,
                  output: JSON.stringify({ ok: false, errors: relayData.errors }),
                },
              });
              sendEvent({ type: "response.create" });
              return;
            }
          }
        } catch (err) {
          console.warn(
            `[voice] action relay failed for ${fnName}, applying raw payload`,
            err?.message,
          );
        }

        onAction?.(validatedAction);

        sendEvent({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: toolOutput,
          },
        });
        sendEvent({ type: "response.create" });
      }
    },
    [onAction, onTranscriptDelta, authHeader, devMode, playPcm16Base64, sendEvent, onError],
  );

  const applySessionBootstrap = useCallback(
    (transportSend) => {
      const boot = sessionBootstrapRef.current;
      if (!boot || typeof transportSend !== "function") return;
      try {
        const payload = buildGrokSessionUpdate(boot);
        transportSend(payload);
        if (devMode) {
          console.info(
            `[voice] session.update applied for ${voiceProviderRef.current}`,
            { tools: (boot.tools || []).length, transport: "ws-or-dc" },
          );
        }
      } catch (err) {
        console.warn("[voice] session.update failed", err?.message);
      }
    },
    [devMode],
  );

  const stopMicCapture = useCallback(() => {
    try {
      micProcessorRef.current?.disconnect?.();
    } catch { /* ignore */ }
    micProcessorRef.current = null;
    try {
      micSourceRef.current?.disconnect?.();
    } catch { /* ignore */ }
    micSourceRef.current = null;
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch { /* ignore */ }
      });
      micStreamRef.current = null;
    }
  }, []);

  const startGrokWebSocket = useCallback(
    async (ephemeralKey) => {
      const wsUrl = buildGrokRealtimeWsUrl({
        realtime_base: realtimeBaseRef.current,
        model: modelRef.current || "grok-voice-latest",
      });
      const protocols = buildGrokWsProtocols(ephemeralKey);

      let stream = null;
      if (captureMicRef.current) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
          },
        });
        if (stoppedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;
        startVu(stream);
      }

      await new Promise((resolve, reject) => {
        let settled = false;
        let ws;
        try {
          ws = new WebSocket(wsUrl, protocols);
        } catch (err) {
          reject(err);
          return;
        }
        wsRef.current = ws;
        ws.binaryType = "arraybuffer";

        const fail = (err) => {
          if (settled) return;
          settled = true;
          reject(err instanceof Error ? err : new Error(String(err)));
        };

        ws.onerror = () => {
          fail(new Error("WebSocket error al conectar con Grok Voice"));
        };

        ws.onclose = (ev) => {
          if (!settled) {
            fail(
              new Error(
                `WebSocket cerrado antes de activar (code=${ev.code}${ev.reason ? ` ${ev.reason}` : ""})`,
              ),
            );
            return;
          }
          if (!stoppedRef.current) {
            setStatus("idle");
            setIsSpeaking(false);
            setIsListening(false);
            stopVu();
            stopRemoteVu();
            stopMicCapture();
          }
        };

        ws.onmessage = (e) => {
          if (typeof e.data === "string") {
            handleRealtimeEvent(e.data);
          }
          // binary frames reserved for optional binary transport — ignore for now
        };

        ws.onopen = () => {
          if (settled) return;
          settled = true;

          const transportSend = (payload) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(typeof payload === "string" ? payload : JSON.stringify(payload));
            }
          };
          sendEventRef.current = transportSend;

          // Always configure session (bootstrap from server or minimal defaults)
          const boot = sessionBootstrapRef.current || {
            instructions: "Sos Panelin, asistente de ventas de BMC Uruguay. Respondé en español rioplatense, breve.",
            tools: [],
          };
          sessionBootstrapRef.current = boot;
          applySessionBootstrap(transportSend);

          // Mic → PCM16 append at 24 kHz (agent session only)
          if (stream) {
            try {
              const ctx = new AudioContext();
              // Prefer native rate; resample to Grok rate on each chunk
              const src = ctx.createMediaStreamSource(stream);
              micSourceRef.current = src;
              const bufferSize = 4096;
              const processor = ctx.createScriptProcessor(bufferSize, 1, 1);
              micProcessorRef.current = processor;
              processor.onaudioprocess = (ev) => {
                if (stoppedRef.current || micMutedRef.current) return;
                const input = ev.inputBuffer.getChannelData(0);
                const resampled = resampleFloat32Linear(
                  input,
                  ctx.sampleRate,
                  GROK_VOICE_SAMPLE_RATE,
                );
                const b64 = float32ToBase64Pcm16(resampled);
                onInputAudioRef.current?.(b64);
                if (ws.readyState === WebSocket.OPEN) {
                  transportSend({
                    type: "input_audio_buffer.append",
                    audio: b64,
                  });
                }
              };
              src.connect(processor);
              // Keep processor alive (mute destination)
              const mute = ctx.createGain();
              mute.gain.value = 0;
              processor.connect(mute);
              mute.connect(ctx.destination);
              if (!audioCtxRef.current) audioCtxRef.current = ctx;
            } catch (err) {
              fail(err);
              return;
            }
          }

          setStatus("active");
          resolve();
        };
      });
    },
    [
      startVu,
      stopVu,
      stopRemoteVu,
      stopMicCapture,
      handleRealtimeEvent,
      applySessionBootstrap,
    ],
  );

  const startOpenAiWebRtc = useCallback(
    async (ephemeralKey) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stoppedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      micStreamRef.current = stream;
      startVu(stream);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      document.body.appendChild(audioEl);
      audioElRef.current = audioEl;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
        startRemoteVu(e.streams[0]);
      };

      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      sendEventRef.current = (payload) => {
        if (dc.readyState === "open") {
          dc.send(typeof payload === "string" ? payload : JSON.stringify(payload));
        }
      };
      dc.onmessage = (e) => handleRealtimeEvent(e.data);
      dc.onopen = () => {
        // OpenAI usually embeds session config at mint; bootstrap only if present
        if (sessionBootstrapRef.current) {
          applySessionBootstrap(sendEventRef.current);
        }
        setStatus("active");
      };
      dc.onclose = () => {
        if (!stoppedRef.current) {
          setStatus("idle");
          setIsSpeaking(false);
          setIsListening(false);
          stopVu();
          stopRemoteVu();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpUrl = resolveSdpEndpoint({
        realtime_base: realtimeBaseRef.current || DEFAULT_REALTIME_BASE,
        model: modelRef.current,
      });
      const sdpRes = await fetch(sdpUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!sdpRes.ok) {
        const hint =
          sdpRes.status === 405
            ? " (405: el host no acepta SDP POST — ¿engine Grok mal ruteado?)"
            : "";
        throw new Error(`SDP negotiation failed: ${sdpRes.status}${hint}`);
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    },
    [
      startVu,
      stopVu,
      startRemoteVu,
      stopRemoteVu,
      handleRealtimeEvent,
      applySessionBootstrap,
    ],
  );

  const start = useCallback(
    async (calcState = {}) => {
      if (status === "connecting" || status === "active") return;
      stoppedRef.current = false;
      calcStateRef.current = calcState || {};
      setStatus("connecting");

      try {
        const headers = { "Content-Type": "application/json" };
        if (authHeader) headers.Authorization = authHeader;
        const sessRes = await fetch(`${API_BASE}/api/agent/voice/session`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            calcState,
            devMode,
            leadContext,
            realtimeModel: realtimeModel || undefined,
            aiProvider,
            aiModel,
            voiceProvider: voiceProvider || undefined,
            kernelRole: kernelRoleRef.current || "agent",
            agentId: agentIdRef.current || undefined,
            surface: surface || undefined,
          }),
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
        realtimeBaseRef.current =
          sessData.realtime_base || DEFAULT_REALTIME_BASE;
        voiceProviderRef.current =
          sessData.provider || sessData.voice_provider || "openai";
        sessionBootstrapRef.current = sessData.session_bootstrap || null;

        const ephemeralKey = sessData.client_secret.value;
        const provider = voiceProviderRef.current;

        if (usesGrokWebSocketTransport(provider)) {
          if (devMode) {
            console.info("[voice] using Grok WebSocket transport (no SDP)", {
              model: modelRef.current,
              base: realtimeBaseRef.current,
            });
          }
          await startGrokWebSocket(ephemeralKey);
        } else {
          await startOpenAiWebRtc(ephemeralKey);
        }
      } catch (err) {
        stoppedRef.current = true;
        setStatus("error");
        setIsSpeaking(false);
        setIsListening(false);
        stopVu();
        stopRemoteVu();
        stopMicCapture();
        try {
          wsRef.current?.close();
        } catch { /* ignore */ }
        wsRef.current = null;
        try {
          pcRef.current?.close();
        } catch { /* ignore */ }
        pcRef.current = null;
        onError?.(err.message || "Error de voz");
      }
    },
    [
      status,
      devMode,
      authHeader,
      leadContext,
      realtimeModel,
      aiProvider,
      aiModel,
      voiceProvider,
      startGrokWebSocket,
      startOpenAiWebRtc,
      stopVu,
      stopRemoteVu,
      stopMicCapture,
      onError,
    ],
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    stopVu();
    stopRemoteVu();
    stopMicCapture();
    sendEventRef.current = null;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch { /* ignore */ }
      wsRef.current = null;
    }
    if (dcRef.current) {
      try {
        dcRef.current.close();
      } catch { /* ignore */ }
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => s.track?.stop());
      try {
        pcRef.current.close();
      } catch { /* ignore */ }
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
    if (remoteAudioCtxRef.current) {
      remoteAudioCtxRef.current.close().catch(() => {});
      remoteAudioCtxRef.current = null;
    }
    if (playCtxRef.current) {
      playCtxRef.current.close().catch(() => {});
      playCtxRef.current = null;
    }
    playTimeRef.current = 0;
    sessionIdRef.current = null;
    setStatus("idle");
    setIsSpeaking(false);
    setIsListening(false);
  }, [stopVu, stopRemoteVu, stopMicCapture]);

  const applyMicMute = useCallback((muted) => {
    const stream = micStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach((t) => {
        t.enabled = !muted;
      });
    }
    if (muted) {
      setVuLevel(0);
      sendEvent({ type: "input_audio_buffer.clear" });
    }
  }, [sendEvent]);

  useEffect(() => {
    applyMicMute(!!micMuted);
  }, [micMuted, applyMicMute]);

  const interrupt = useCallback(() => {
    sendEvent({ type: "response.cancel" });
    setIsSpeaking(false);
  }, [sendEvent]);

  const stopPlayback = useCallback(() => {
    sendEvent({ type: "response.cancel" });
    setIsSpeaking(false);
    setRemoteVuLevel(0);
    if (playCtxRef.current) {
      playCtxRef.current.close().catch(() => {});
      playCtxRef.current = null;
    }
    playTimeRef.current = 0;
  }, [sendEvent]);

  useEffect(() => {
    if (playOutput) return undefined;
    stopPlayback();
    return undefined;
  }, [playOutput, stopPlayback]);

  const feedAudio = useCallback((b64) => {
    if (!b64 || stoppedRef.current) return;
    sendEvent({ type: "input_audio_buffer.append", audio: b64 });
  }, [sendEvent]);

  const updateInstructions = useCallback((instructions, extra = {}) => {
    const boot = {
      ...(sessionBootstrapRef.current || {}),
      ...extra,
      instructions,
    };
    sessionBootstrapRef.current = boot;
    applySessionBootstrap(sendEvent);
  }, [applySessionBootstrap, sendEvent]);

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    isSpeaking,
    isListening,
    vuLevel,
    remoteVuLevel,
    start,
    stop,
    interrupt,
    feedAudio,
    updateInstructions,
    sendEvent,
    stopPlayback,
  };
}
