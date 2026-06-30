import { useState, useRef, useCallback, useEffect } from "react";

const PHASE_LISTENING = "Escuchando…";

// Brand wake word + the variants Spanish ASR commonly returns for the coined
// word "Panelín" — it tends to add the accent ("panelín") or split it ("panel in").
const WAKE_WORDS = ["panelin", "panel in", "panelina", "panecillo"];
// Accent stripping reuses the repo idiom (BmcLogisticaApp.jsx, BmcPlanosModule.jsx).
const normWake = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Tolerant wake-word test: accent-insensitive, and collapses spaces so the
// split transcription "panel in" still matches the contiguous "panelin".
export const hasWake = (text) => {
  if (!text) return false;
  const n = normWake(text);
  return n.replace(/[^a-z0-9]/g, "").includes("panelin") || WAKE_WORDS.some((w) => n.includes(w));
};

export function useHandsFreeVoice({ onError, send, messages = [] }) {
  const [status, setStatus] = useState("idle");
  const [phase, setPhase] = useState("Esperando &quot;Panelin&quot;…");
  const [transcript, setTranscript] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [vuLevel, setVuLevel] = useState(0);

  const SR = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const currentPhaseRef = useRef("idle");
  const messagesCountRef = useRef(messages.length);
  const bargeInRecRef = useRef(null);
  const thinkingTimeoutRef = useRef(null);
  const startWakeWordDetectionRef = useRef(null);

  useEffect(() => {
    const getSR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
    SR.current = getSR() ? new (getSR())() : null;
  }, []);

  const playBeep = useCallback(() => {
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      // Silently fail if AudioContext unavailable
    }
  }, []);

  const startVU = useCallback(() => {
    if (!micStreamRef.current || !SR.current) return;
    try {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioContextRef.current;
      if (!analyserRef.current) {
        const source = ctx.createMediaStreamSource(micStreamRef.current);
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
      }
    } catch {
      // Silently continue if VU unavailable
    }
  }, []);

  const updateVU = useCallback(() => {
    if (!analyserRef.current) {
      setVuLevel(0);
      return;
    }
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
    setVuLevel(Math.min(1, avg / 255));
  }, []);

  const speakText = useCallback((text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve();

    return new Promise((resolve) => {
      const speak = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "es-UY";
        utterance.rate = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const esVoice = voices.find((v) => v.lang.startsWith("es"));
        if (esVoice) utterance.voice = esVoice;

        utterance.onend = () => {
          setIsSpeaking(false);
          resolve();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          resolve();
        };

        setIsSpeaking(true);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      };

      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) speak();
      else window.speechSynthesis.addEventListener("voiceschanged", speak, { once: true });
    });
  }, []);

  const startQueryListening = useCallback(() => {
    if (!SR.current) return;

    SR.current.continuous = false;
    SR.current.interimResults = true;

    let finalTranscript = "";

    SR.current.onresult = (event) => {
      updateVU();
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript([{ role: "user", text: (finalTranscript || interimTranscript).trim() }]);
    };

    SR.current.onend = () => {
      if (currentPhaseRef.current === "listening" && finalTranscript.trim()) {
        setPhase("Pensando…");
        currentPhaseRef.current = "thinking";
        messagesCountRef.current = messages.length;
        send(finalTranscript.trim());

        thinkingTimeoutRef.current = setTimeout(() => {
          if (currentPhaseRef.current === "thinking") {
            speakText("Lo siento, hubo un error. Decí 'Panelin' para comenzar.")
              .then(() => startWakeWordDetectionRef.current?.());
          }
        }, 30000);
      }
    };

    SR.current.onerror = (event) => {
      if (event.error === "not-allowed") {
        onError?.("Permiso de micrófono denegado");
        setStatus("error");
      }
    };

    SR.current.start();
  }, [updateVU, send, messages.length, speakText, onError]);

  const startWakeWordDetection = useCallback(() => {
    if (!SR.current) {
      onError?.("SpeechRecognition no disponible en este navegador");
      setStatus("error");
      return;
    }

    try {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        micStreamRef.current = stream;
        startVU();
      });
    } catch (e) {
      // Mic access will be requested via SR anyway
    }

    SR.current.continuous = true;
    SR.current.interimResults = true;
    SR.current.lang = "es-419"; // Latin-American Spanish (Rioplatense) — better on the coined brand word

    SR.current.onresult = (event) => {
      updateVU();
      let hasWakeWord = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        // Check interim results too: with continuous=true the wake word can sit
        // un-finalized for a long time, so waiting for isFinal adds latency/misses.
        if (hasWake(event.results[i][0].transcript)) {
          hasWakeWord = true;
        }
      }

      if (hasWakeWord && currentPhaseRef.current === "waking") {
        SR.current.abort();
        playBeep();
        setPhase(PHASE_LISTENING);
        currentPhaseRef.current = "listening";
        startQueryListening();
      }
    };

    SR.current.onerror = (event) => {
      if (event.error === "not-allowed") {
        onError?.("Permiso de micrófono denegado");
        setStatus("error");
      } else if (event.error === "network" || event.error === "audio-capture") {
        // Don't let a dead recognition loop masquerade as a healthy "waiting"
        // state — show a transient hint; onend below restarts and resets the phase.
        console.warn("[voice] wake word error:", event.error);
        if (currentPhaseRef.current === "waking") setPhase("Reconectando voz…");
      } else if (event.error !== "no-speech") {
        console.warn("[voice] wake word error:", event.error);
      }
    };

    SR.current.onend = () => {
      if (currentPhaseRef.current === "waking") {
        // Restart if still in wake phase
        setTimeout(() => {
          if (currentPhaseRef.current === "waking" && SR.current) {
            try {
              SR.current.start();
              setPhase("Esperando 'Panelin'…"); // clear any "Reconectando voz…" hint
            } catch {
              // start() throws if recognition is already running — safe to ignore
            }
          }
        }, 100);
      }
    };

    SR.current.start();
    setStatus("active");
    currentPhaseRef.current = "waking";
    setPhase("Esperando 'Panelin'…");
  }, [onError, startVU, updateVU, playBeep, startQueryListening]);

  useEffect(() => {
    startWakeWordDetectionRef.current = startWakeWordDetection;
  }, [startWakeWordDetection]);

  useEffect(() => {
    if (currentPhaseRef.current === "thinking" && messages.length > messagesCountRef.current) {
      const newMessages = messages.slice(messagesCountRef.current);
      const assistantMsg = newMessages.find((m) => m.role === "assistant");

      if (assistantMsg && assistantMsg.content) {
        clearTimeout(thinkingTimeoutRef.current);
        setPhase("Hablando…");
        currentPhaseRef.current = "speaking";
        setTranscript((prev) => [
          ...prev,
          { role: "assistant", text: assistantMsg.content },
        ]);

        speakText(assistantMsg.content)
          .then(() => {
            // Start barge-in detection
            if (SR.current) {
              SR.current.continuous = true;
              SR.current.interimResults = true;
              SR.current.lang = "es-419"; // Latin-American Spanish (Rioplatense) — better on the coined brand word

              SR.current.onresult = (event) => {
                for (let i = event.resultIndex; i < event.results.length; i++) {
                  const trans = event.results[i][0].transcript;
                  if (hasWake(trans)) {
                    window.speechSynthesis.cancel();
                    SR.current.abort();
                    playBeep();
                    setPhase(PHASE_LISTENING);
                    currentPhaseRef.current = "listening";
                    startQueryListening();
                    return;
                  }
                }
              };

              SR.current.start();
            }
          })
          .catch(() => {
            startWakeWordDetection();
          });
      }
    }
  }, [messages, speakText, startWakeWordDetection, startQueryListening, playBeep]);

  const start = useCallback(() => {
    if (!SR.current) {
      onError?.("SpeechRecognition no disponible");
      setStatus("error");
      return;
    }
    setStatus("active");
    setTranscript([]);
    startWakeWordDetection();
  }, [onError, startWakeWordDetection]);

  const stop = useCallback(() => {
    if (SR.current) SR.current.abort();
    if (bargeInRecRef.current) bargeInRecRef.current.abort();
    window.speechSynthesis?.cancel();
    clearTimeout(thinkingTimeoutRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    setStatus("idle");
    currentPhaseRef.current = "idle";
    setPhase("Esperando 'Panelin'…");
    setTranscript([]);
  }, []);

  useEffect(() => {
    const interval = setInterval(updateVU, 100);
    return () => clearInterval(interval);
  }, [updateVU]);

  const isListening = phase === PHASE_LISTENING;

  return {
    status,
    phase,
    transcript,
    isSpeaking,
    isListening,
    vuLevel,
    start,
    stop,
  };
}
