import { useState, useRef, useCallback, useEffect } from "react";

const WAKE_WORD = "panelin";
const WAITING_PHASE = "Esperando \"Panelin\"…";
const LISTENING_PHASE = "Escuchando…";
const THINKING_PHASE = "Pensando…";
const SPEAKING_PHASE = "Hablando…";

export function useHandsFreeVoice({ onError, send, messages = [], isStreaming = false }) {
  const [status, setStatus] = useState("idle");
  const [phase, setPhase] = useState(WAITING_PHASE);
  const [transcript, setTranscript] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [vuLevel, setVuLevel] = useState(0);

  const SR = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const currentPhaseRef = useRef("idle");
  const messagesCountRef = useRef(messages.length);
  const thinkingTimeoutRef = useRef(null);
  const startQueryListeningRef = useRef(null);
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

  const startWakeWordDetection = useCallback(() => {
    if (!SR.current) {
      onError?.("SpeechRecognition no disponible en este navegador");
      setStatus("error");
      return;
    }

    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        micStreamRef.current = stream;
        startVU();
      })
      .catch((err) => {
        // SpeechRecognition.start() will also prompt for mic access, so a
        // failure here is non-fatal; log it to aid debugging (the SR onerror
        // handler reports an actionable message if permission is denied).
        console.warn("[voice] getUserMedia failed:", err?.name || err);
      });

    SR.current.continuous = true;
    SR.current.interimResults = true;
    SR.current.lang = "es-ES";

    SR.current.onresult = (event) => {
      updateVU();
      let hasWakeWord = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i][0].transcript;
        if (event.results[i].isFinal && result.toLowerCase().includes(WAKE_WORD)) {
          hasWakeWord = true;
        }
      }

      if (hasWakeWord && currentPhaseRef.current === "waking") {
        SR.current.abort();
        playBeep();
        setPhase(LISTENING_PHASE);
        currentPhaseRef.current = "listening";
        startQueryListeningRef.current?.();
      }
    };

    SR.current.onerror = (event) => {
      if (event.error === "not-allowed") {
        onError?.("Permiso de micrófono denegado");
        setStatus("error");
      } else if (event.error !== "no-speech") {
        console.warn("[voice] wake word error:", event.error);
      }
    };

    SR.current.onend = () => {
      if (currentPhaseRef.current === "waking") {
        // Restart if still in wake phase
        setTimeout(() => {
          if (currentPhaseRef.current === "waking" && SR.current) {
            SR.current.start();
          }
        }, 100);
      }
    };

    SR.current.start();
    setStatus("active");
    currentPhaseRef.current = "waking";
    setPhase(WAITING_PHASE);
  }, [onError, startVU, updateVU, playBeep]);

  const startQueryListening = useCallback(() => {
    if (!SR.current) return;

    SR.current.continuous = false;
    SR.current.interimResults = true;

    let finalTranscript = "";

    SR.current.onresult = (event) => {
      updateVU();
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += result + " ";
        } else {
          interimTranscript += result;
        }
      }

      setTranscript([{ role: "user", text: (finalTranscript || interimTranscript).trim() }]);
    };

    SR.current.onend = () => {
      if (currentPhaseRef.current === "listening" && finalTranscript.trim()) {
        setPhase(THINKING_PHASE);
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

  // Keep refs in sync outside of render so the wake-word and barge-in
  // recognizers can call the latest callbacks without forward references.
  useEffect(() => {
    startWakeWordDetectionRef.current = startWakeWordDetection;
    startQueryListeningRef.current = startQueryListening;
  }, [startWakeWordDetection, startQueryListening]);

  // Listen for the wake word *while* the assistant is speaking so the user can
  // barge in. Runs concurrently with TTS (not after it finishes).
  const startBargeInListening = useCallback(() => {
    if (!SR.current) return;
    SR.current.continuous = true;
    SR.current.interimResults = true;
    SR.current.lang = "es-ES";

    SR.current.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const trans = event.results[i][0].transcript;
        if (trans.toLowerCase().includes(WAKE_WORD)) {
          window.speechSynthesis?.cancel();
          setIsSpeaking(false);
          SR.current.abort();
          playBeep();
          setPhase(LISTENING_PHASE);
          currentPhaseRef.current = "listening";
          startQueryListeningRef.current?.();
          return;
        }
      }
    };

    SR.current.onerror = () => {
      // Ignore barge-in recognition errors (e.g. no-speech); TTS keeps playing.
    };

    SR.current.onend = () => {
      // Restart while the assistant is still speaking so barge-in stays live.
      if (currentPhaseRef.current === "speaking" && SR.current) {
        try {
          SR.current.start();
        } catch {
          // Already started or unavailable; ignore.
        }
      }
    };

    try {
      SR.current.start();
    } catch {
      // Already started; ignore.
    }
  }, [playBeep]);

  useEffect(() => {
    if (currentPhaseRef.current !== "thinking") return;
    // Wait until the streamed reply has fully finished before speaking it,
    // otherwise only the first chunk would be read aloud.
    if (isStreaming) return;
    if (messages.length <= messagesCountRef.current) return;

    const newMessages = messages.slice(messagesCountRef.current);
    const assistantMsg = [...newMessages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content);

    if (!assistantMsg) return;

    clearTimeout(thinkingTimeoutRef.current);
    setPhase(SPEAKING_PHASE);
    currentPhaseRef.current = "speaking";
    setTranscript((prev) => [...prev, { role: "assistant", text: assistantMsg.content }]);

    // Start barge-in detection concurrently with speech.
    startBargeInListening();

    const resumeWake = () => {
      if (currentPhaseRef.current === "speaking") {
        SR.current?.abort();
        startWakeWordDetectionRef.current?.();
      }
    };

    speakText(assistantMsg.content).then(resumeWake).catch(resumeWake);
  }, [messages, isStreaming, speakText, startBargeInListening]);

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
    window.speechSynthesis?.cancel();
    clearTimeout(thinkingTimeoutRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    setStatus("idle");
    currentPhaseRef.current = "idle";
    setPhase(WAITING_PHASE);
    setTranscript([]);
    setIsSpeaking(false);
    setVuLevel(0);
  }, []);

  useEffect(() => {
    const interval = setInterval(updateVU, 100);
    return () => clearInterval(interval);
  }, [updateVU]);

  const isListening = phase === LISTENING_PHASE;

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
