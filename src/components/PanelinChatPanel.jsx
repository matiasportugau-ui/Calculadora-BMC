import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, RotateCcw, Send, Mic, Volume2, VolumeX, Square } from "lucide-react";
import PanelinDevPanel from "./PanelinDevPanel.jsx";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";
const BRAND = "#1a3a5c";
const PRIMARY = "#0071e3";
const SURFACE = "#f5f5f7";
const BORDER = "#e5e5ea";
const TEXT = "#1d1d1f";
const SUBTEXT = "#6e6e73";
const STORAGE_SELECTED_SKIN = "panelin-chat-selected-skin-v1";
const STORAGE_CUSTOM_SKINS = "panelin-chat-custom-skins-v1";
const BUILTIN_SKINS = [
  {
    id: "classic",
    name: "Classic BMC",
    tokens: {
      brand: "#1a3a5c",
      primary: "#0071e3",
      surface: "#f5f5f7",
      border: "#e5e5ea",
      text: "#1d1d1f",
      subtext: "#6e6e73",
      drawerBg: "#ffffff",
      backdrop: "rgba(0,0,0,0.35)",
      headerText: "#ffffff",
      userBubbleText: "#ffffff",
      assistantBubbleText: "#1d1d1f",
    },
  },
  {
    id: "night",
    name: "Night Steel",
    tokens: {
      brand: "#101A2B",
      primary: "#3B82F6",
      surface: "#1A2438",
      border: "#2A3955",
      text: "#E5E7EB",
      subtext: "#94A3B8",
      drawerBg: "#0F172A",
      backdrop: "rgba(2,6,23,0.62)",
      headerText: "#F8FAFC",
      userBubbleText: "#F8FAFC",
      assistantBubbleText: "#E5E7EB",
    },
  },
  {
    id: "sand",
    name: "Arena Soft",
    tokens: {
      brand: "#5A4632",
      primary: "#C9863A",
      surface: "#F7EFE6",
      border: "#E8D7C5",
      text: "#2E241B",
      subtext: "#7A6551",
      drawerBg: "#FFFDFB",
      backdrop: "rgba(34,24,16,0.34)",
      headerText: "#FFF9F3",
      userBubbleText: "#FFFFFF",
      assistantBubbleText: "#2E241B",
    },
  },
];
const VIDEO_SRC = `${typeof import.meta !== "undefined" ? import.meta.env?.BASE_URL ?? "/" : "/"}video/panelin-lista-loop.mp4`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function buildSkinMap() {
  return new Map(BUILTIN_SKINS.map((skin) => [skin.id, skin]));
}

function loadCustomSkins() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_SKINS);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((skin) => skin && skin.id && skin.name && skin.tokens);
  } catch {
    return [];
  }
}

function saveCustomSkins(customSkins) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_CUSTOM_SKINS, JSON.stringify(customSkins));
  } catch {
    // Ignore storage failures (private mode / quota).
  }
}

function makeSkinDraftFromTokens(tokens) {
  const base = BUILTIN_SKINS[0].tokens;
  return {
    name: "",
    brand: tokens?.brand || base.brand,
    primary: tokens?.primary || base.primary,
    surface: tokens?.surface || base.surface,
    border: tokens?.border || base.border,
    text: tokens?.text || base.text,
    subtext: tokens?.subtext || base.subtext,
    drawerBg: tokens?.drawerBg || base.drawerBg,
    headerText: tokens?.headerText || base.headerText,
    backdrop: tokens?.backdrop || base.backdrop,
    userBubbleText: tokens?.userBubbleText || base.userBubbleText,
    assistantBubbleText: tokens?.assistantBubbleText || base.assistantBubbleText,
  };
}

function makeNextCustomSkinId(existingSkins) {
  let idx = existingSkins.length + 1;
  let candidate = `custom-${idx}`;
  const ids = new Set(existingSkins.map((skin) => skin.id));
  while (ids.has(candidate)) {
    idx += 1;
    candidate = `custom-${idx}`;
  }
  return candidate;
}

const ACTION_LABELS = {
  setScenario:   (p) => `Escenario → ${p}`,
  setLP:         (p) => `Lista → ${p === "web" ? "Precio web" : "Precio venta"}`,
  setTecho:      (p) => `Techo → ${Object.entries(p).filter(([,v]) => v != null && v !== "").map(([k,v]) => {
    if (k === "borders" && typeof v === "object" && !Array.isArray(v)) {
      const sides = Object.entries(v).filter(([,s]) => s && s !== "none").map(([side, style]) => `${side}:${style}`);
      return `bordes=[${sides.join(", ")}]`;
    }
    if (Array.isArray(v)) return `${k}=${v.map(z=>`${z.largo}×${z.ancho}m`).join(", ")}`;
    return `${k}=${v}`;
  }).join(", ")}`,
  setPared:      (p) => `Pared → ${Object.entries(p).filter(([,v]) => v != null && v !== "").map(([k,v]) => `${k}=${v}`).join(", ")}`,
  setCamara:     (p) => `Cámara → ${p.largo_int}×${p.ancho_int}×${p.alto_int}m`,
  setFlete:      (p) => `Flete → USD ${p}`,
  setProyecto:   (p) => `Proyecto → ${Object.entries(p).filter(([,v]) => v).map(([k,v]) => `${k}=${v}`).join(", ")}`,
  setWizardStep: (p) => `Paso → ${p}`,
  setTechoZonas: (p) => `Zonas techo → ${Array.isArray(p) ? p.map((z,i)=>`Zona ${i+1}: ${z.largo}×${z.ancho}m`).join(", ") : p}`,
  advanceWizard: ()  => `Avanzó al siguiente paso`,
};

// Inject dot-pulse keyframe once
if (typeof document !== "undefined" && !document.getElementById("panelin-chat-kf")) {
  const s = document.createElement("style");
  s.id = "panelin-chat-kf";
  s.textContent = `
    @keyframes panelin-pulse { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
    .panelin-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:${SUBTEXT}; margin:0 2px; animation:panelin-pulse 1.2s infinite ease-in-out; }
    .panelin-dot:nth-child(2){ animation-delay:0.2s; }
    .panelin-dot:nth-child(3){ animation-delay:0.4s; }
    @keyframes panelin-action-fade { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-8px)} }
    @keyframes panelin-mic-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,59,48,0.4)} 50%{box-shadow:0 0 0 8px rgba(255,59,48,0)} }
  `;
  document.head.appendChild(s);
}

function Avatar({ size = 28 }) {
  return (
    <video
      src={VIDEO_SRC}
      autoPlay
      muted
      loop
      playsInline
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        background: BRAND,
      }}
    />
  );
}


/**
 * Panelin AI chat drawer.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   messages: Array<{id:string, role:string, content:string, pending?:boolean}>,
 *   isStreaming: boolean,
 *   send: (text:string) => void,
 *   clear: () => void,
 *   error: string|null,
 *   devMode?: boolean,
 *   onToggleDevMode?: () => void,
 *   devMeta?: object,
 *   trainingEntries?: Array<object>,
 *   trainingStats?: object,
 *   promptPreview?: string,
 *   promptSections?: object,
 *   onSaveCorrection?: (payload: object) => Promise<void>,
 *   onReloadTrainingKB?: () => Promise<void>,
 *   onReloadPromptPreview?: () => Promise<void>,
 *   onReloadPromptSections?: () => Promise<void>,
 *   onSavePromptSection?: (payload: object) => Promise<void>,
 *   onVerifyCalculation?: (text: string) => Promise<void>,
 *   detachedMode?: boolean,
 *   onOpenDetachedWindow?: () => void,
 *   aiProvider?: string,
 *   setAiProvider?: (p: string) => void,
 *   setAiModel?: (m: string) => void,
 *   aiOptions?: { ok?: boolean, providers?: Array<{ id: string, label: string, defaultModel: string, models: Array<{ id: string, label: string }> }> } | null,
 *   aiOptionsError?: string | null,
 * }} props
 */
export default function PanelinChatPanel({
  isOpen,
  onClose,
  messages,
  isStreaming,
  send,
  stop,
  retry,
  clear,
  error,
  devMode = false,
  onToggleDevMode,
  aiProvider = "auto",
  setAiProvider,
  setAiModel,
  aiOptions = null,
  aiOptionsError = null,
  devMeta,
  trainingEntries,
  trainingStats,
  promptPreview,
  promptSections,
  onSaveCorrection,
  onReloadTrainingKB,
  onReloadPromptPreview,
  onReloadPromptSections,
  onSavePromptSection,
  onVerifyCalculation,
  detachedMode = false,
  onOpenDetachedWindow,
}) {
  const [isSkinMenuOpen, setIsSkinMenuOpen] = useState(false);
  const [customSkins, setCustomSkins] = useState(() => loadCustomSkins());
  const [skinEditorOpen, setSkinEditorOpen] = useState(false);
  const [skinDraft, setSkinDraft] = useState(() => makeSkinDraftFromTokens(BUILTIN_SKINS[0].tokens));
  const [selectedSkinId, setSelectedSkinId] = useState(() => {
    if (typeof window === "undefined") return "classic";
    return localStorage.getItem(STORAGE_SELECTED_SKIN) || "classic";
  });
  const [input, setInput] = useState("");
  const [correctingMsgId, setCorrectingMsgId] = useState(null);
  const [correctionText, setCorrectionText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [devDrawerWidth, setDevDrawerWidth] = useState(() => {
    if (typeof window === "undefined") return 460;
    const raw = Number(sessionStorage.getItem("panelin-dev-drawer-width"));
    return Number.isFinite(raw) && raw > 0 ? raw : 460;
  });
  const [devInputLift, setDevInputLift] = useState(() => {
    if (typeof window === "undefined") return 0;
    const raw = Number(sessionStorage.getItem("panelin-dev-input-lift"));
    return Number.isFinite(raw) && raw >= 0 ? raw : 0;
  });
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const openerRef = useRef(null);
  const recognitionRef = useRef(null);
  const prevMsgCountRef = useRef(0);
  const drawerResizeActiveRef = useRef(false);
  const inputLiftDragActiveRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragStartWidthRef = useRef(0);
  const dragStartLiftRef = useRef(0);

  const skinMap = useMemo(() => {
    const map = buildSkinMap();
    customSkins.forEach((skin) => map.set(skin.id, skin));
    return map;
  }, [customSkins]);

  const skinOptions = useMemo(() => Array.from(skinMap.values()), [skinMap]);
  const activeSkin = skinMap.get(selectedSkinId) || skinMap.get("classic") || BUILTIN_SKINS[0];
  const activeTokens = skinEditorOpen ? { ...activeSkin.tokens, ...skinDraft } : activeSkin.tokens;
  const {
    brand: BRAND_COLOR,
    primary: PRIMARY_COLOR,
    surface: SURFACE_COLOR,
    border: BORDER_COLOR,
    text: TEXT_COLOR,
    subtext: SUBTEXT_COLOR,
    drawerBg: DRAWER_BG_COLOR,
    backdrop: BACKDROP_COLOR,
    headerText: HEADER_TEXT_COLOR,
    userBubbleText: USER_BUBBLE_TEXT_COLOR = "#ffffff",
    assistantBubbleText: ASSISTANT_BUBBLE_TEXT_COLOR = TEXT_COLOR,
  } = activeTokens;

  // 2.5 — Smart auto-scroll: only scroll if near bottom
  useEffect(() => {
    if (isOpen && isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (isOpen && !isNearBottom) {
      setShowScrollBtn(true);
    }
  }, [messages, isOpen, isNearBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsNearBottom(nearBottom);
    if (nearBottom) setShowScrollBtn(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
    setIsNearBottom(true);
  }, []);

  // Focus input when drawer opens; restore focus on close
  useEffect(() => {
    if (isOpen) {
      openerRef.current = document.activeElement;
      setTimeout(() => textareaRef.current?.focus(), 300);
    } else {
      openerRef.current?.focus();
    }
  }, [isOpen]);

  // 2.3 — Escape key closes drawer
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // 2.2 — Focus trap: keep Tab/Shift+Tab inside drawer
  const drawerRef = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const el = drawerRef.current;
    if (!el) return;
    const handler = (e) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        el.querySelectorAll('button:not([disabled]),textarea:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')
      ).filter((n) => n.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [isOpen]);

  // TTS: read new assistant messages aloud when enabled
  useEffect(() => {
    if (!ttsEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    const count = messages.length;
    if (count > prevMsgCountRef.current) {
      const last = messages[count - 1];
      if (last && last.role === "assistant" && last.content && !last.pending) {
        const speak = () => {
          const utterance = new SpeechSynthesisUtterance(last.content);
          utterance.lang = "es-UY";
          utterance.rate = 1.0;
          // 4.4 — getVoices() may be empty on first call; resolve after voiceschanged
          const voices = window.speechSynthesis.getVoices();
          const esVoice = voices.find((v) => v.lang.startsWith("es"));
          if (esVoice) utterance.voice = esVoice;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        };
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          speak();
        } else {
          window.speechSynthesis.addEventListener("voiceschanged", speak, { once: true });
        }
      }
    }
    prevMsgCountRef.current = count;
  }, [messages, ttsEnabled]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !devMode) return;
    sessionStorage.setItem("panelin-dev-drawer-width", String(devDrawerWidth));
  }, [devDrawerWidth, devMode]);

  useEffect(() => {
    if (typeof window === "undefined" || !devMode) return;
    sessionStorage.setItem("panelin-dev-input-lift", String(devInputLift));
  }, [devInputLift, devMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_SELECTED_SKIN, selectedSkinId);
  }, [selectedSkinId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPointerMove = (e) => {
      if (drawerResizeActiveRef.current) {
        const hardMax = Math.min(980, Math.floor(window.innerWidth * 0.98));
        const delta = dragStartXRef.current - e.clientX;
        setDevDrawerWidth(clamp(dragStartWidthRef.current + delta, 320, hardMax));
      }
      if (inputLiftDragActiveRef.current) {
        const delta = dragStartYRef.current - e.clientY;
        setDevInputLift(clamp(dragStartLiftRef.current + delta, 0, 260));
      }
    };
    const stopDragging = () => {
      drawerResizeActiveRef.current = false;
      inputLiftDragActiveRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  const speakMessage = useCallback((text) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-UY";
      utterance.rate = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const esVoice = voices.find((v) => v.lang.startsWith("es"));
      if (esVoice) utterance.voice = esVoice;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) speak();
    else window.speechSynthesis.addEventListener("voiceschanged", speak, { once: true });
  }, []);

  const toggleListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz. Usá Chrome o Edge.");
      return;
    }
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "es-UY";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let finalTranscript = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interim += t;
        }
      }
      setInput(finalTranscript || interim);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      if (finalTranscript) {
        setInput(finalTranscript);
      }
    };
    recognition.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    send(text);
  }, [input, isStreaming, send]);

  const saveCurrentSkin = () => {
    const name = typeof window !== "undefined" ? window.prompt("Nombre de la skin:") : "";
    const trimmed = name?.trim();
    if (!trimmed) return;
    const id = makeNextCustomSkinId(customSkins);
    const newSkin = {
      id,
      name: trimmed,
      tokens: activeSkin.tokens,
      locked: false,
    };
    setCustomSkins((prev) => {
      const next = [...prev, newSkin];
      saveCustomSkins(next);
      return next;
    });
    setSelectedSkinId(id);
  };

  const renameSkin = (skinId) => {
    const target = customSkins.find((s) => s.id === skinId);
    if (!target) return;
    const name = typeof window !== "undefined" ? window.prompt("Nuevo nombre de skin:", target.name) : "";
    const trimmed = name?.trim();
    if (!trimmed) return;
    setCustomSkins((prev) => {
      const next = prev.map((s) => (s.id === skinId ? { ...s, name: trimmed } : s));
      saveCustomSkins(next);
      return next;
    });
  };

  const toggleSkinLock = (skinId) => {
    setCustomSkins((prev) => {
      const next = prev.map((s) => (s.id === skinId ? { ...s, locked: !s.locked } : s));
      saveCustomSkins(next);
      return next;
    });
  };

  const deleteSkin = (skinId) => {
    const target = customSkins.find((s) => s.id === skinId);
    if (!target || target.locked) return;
    const ok = typeof window !== "undefined"
      ? window.confirm(`Eliminar skin "${target.name}"?`)
      : false;
    if (!ok) return;
    setCustomSkins((prev) => {
      const next = prev.filter((s) => s.id !== skinId);
      saveCustomSkins(next);
      return next;
    });
    if (selectedSkinId === skinId) {
      setSelectedSkinId("classic");
    }
  };

  const createSkinFromEditor = () => {
    const name = skinDraft.name.trim();
    if (!name) return;
    const id = makeNextCustomSkinId(customSkins);
    const newSkin = {
      id,
      name,
      locked: false,
      tokens: {
        ...activeSkin.tokens,
        brand: skinDraft.brand,
        primary: skinDraft.primary,
        surface: skinDraft.surface,
        border: skinDraft.border,
        text: skinDraft.text,
        subtext: skinDraft.subtext,
        drawerBg: skinDraft.drawerBg,
        headerText: skinDraft.headerText,
        backdrop: skinDraft.backdrop,
        userBubbleText: skinDraft.userBubbleText,
        assistantBubbleText: skinDraft.assistantBubbleText,
      },
    };
    setCustomSkins((prev) => {
      const next = [...prev, newSkin];
      saveCustomSkins(next);
      return next;
    });
    setSelectedSkinId(id);
    setSkinEditorOpen(false);
    setSkinDraft(makeSkinDraftFromTokens(newSkin.tokens));
  };

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Auto-grow textarea
  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
  };

  const isEmpty = messages.length === 0;
  const aiProvidersList = Array.isArray(aiOptions?.providers) ? aiOptions.providers : [];
  const aiOptionsLoading = aiOptions === null && !aiOptionsError;
  const selectBase = {
    fontSize: 11,
    maxWidth: "min(100%, 220px)",
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.12)",
    color: HEADER_TEXT_COLOR,
    cursor: "pointer",
  };
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const devDrawerMax = Math.min(860, Math.floor(viewportWidth * 0.95));
  const drawerMaxWidth = devMode ? clamp(devDrawerWidth, 320, devDrawerMax) : 380;
  const startDrawerResize = (e) => {
    if (!devMode || detachedMode) return;
    e.preventDefault();
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = devDrawerWidth;
    drawerResizeActiveRef.current = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  };
  const startInputLiftDrag = (e) => {
    if (!devMode) return;
    e.preventDefault();
    dragStartYRef.current = e.clientY;
    dragStartLiftRef.current = devInputLift;
    inputLiftDragActiveRef.current = true;
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 299,
          background: detachedMode ? "transparent" : BACKDROP_COLOR,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen && !detachedMode ? "auto" : "none",
          transition: "opacity 200ms ease",
        }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-label="Panelin Asistente BMC"
        aria-modal="true"
        style={{
          position: "fixed",
          top: 0,
          right: detachedMode ? "auto" : 0,
          left: detachedMode ? 0 : "auto",
          height: "100dvh",
          zIndex: 300,
          width: "100%",
          maxWidth: detachedMode ? "100%" : drawerMaxWidth,
          background: DRAWER_BG_COLOR,
          boxShadow: detachedMode ? "none" : "-4px 0 32px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          transform: detachedMode ? "translateX(0)" : (isOpen ? "translateX(0)" : "translateX(100%)"),
          transition: detachedMode ? "none" : "transform 280ms cubic-bezier(0.4,0,0.2,1)",
          fontFamily: FONT,
          willChange: "transform",
        }}
      >
        {devMode && !detachedMode && (
          <div
            onPointerDown={startDrawerResize}
            title="Arrastrar para redimensionar panel"
            style={{
              position: "absolute",
              left: -6,
              top: 0,
              width: 12,
              height: "100%",
              borderLeft: "2px solid rgba(0,113,227,0.35)",
              background:
                "linear-gradient(to right, rgba(0,113,227,0.16), rgba(0,113,227,0.06), transparent)",
              cursor: "ew-resize",
              touchAction: "none",
              zIndex: 5,
            }}
          />
        )}
        {/* ── Header ── */}
        <div
          style={{
            background: BRAND_COLOR,
            color: HEADER_TEXT_COLOR,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <Avatar size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Panelin</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              Asistente BMC Uruguay{devMode ? " · Developer Mode" : ""}
            </div>
            {setAiProvider && (
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <label style={{ fontSize: 10, opacity: 0.9, display: "flex", alignItems: "center", gap: 6, margin: 0 }}>
                  <span>IA</span>
                  <select
                    aria-label="Motor de IA (simple)"
                    value={aiProvider}
                    disabled={isStreaming || aiOptionsLoading}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAiProvider(v);
                      setAiModel?.("");
                    }}
                    style={selectBase}
                    title="Automático prueba proveedores en orden. Elegí un proveedor para fijar el motor (modelo por defecto del servidor)."
                  >
                    <option value="auto">
                      {aiOptionsLoading ? "Cargando…" : "Automático"}
                    </option>
                    {aiProvidersList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                {aiOptionsError && (
                  <span style={{ fontSize: 10, opacity: 0.75 }} title={aiOptionsError}>
                    Sin lista (¿API en :3001?)
                  </span>
                )}
                {!aiOptionsLoading && !aiOptionsError && aiProvidersList.length === 0 && (
                  <span style={{ fontSize: 10, opacity: 0.75 }} title="Definí al menos una key en .env del servidor">
                    Sin keys en API
                  </span>
                )}
              </div>
            )}
          </div>
          {onToggleDevMode && (
            <button
              onClick={onToggleDevMode}
              title={devMode ? "Developer mode activo (Ctrl/Cmd + Shift + D)" : "Activar Developer mode (Ctrl/Cmd + Shift + D)"}
              style={{
                ...ghostBtn,
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 999,
                padding: "4px 8px",
                fontSize: 11,
                color: "#fff",
                background: devMode ? "rgba(255,255,255,0.24)" : "transparent",
              }}
              aria-label={devMode ? "Developer mode activo" : "Activar Developer mode"}
            >
              DEV
            </button>
          )}
          {devMode && onOpenDetachedWindow && (
            <button
              onClick={onOpenDetachedWindow}
              title="Abrir en ventana separada"
              style={{
                ...ghostBtn,
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 999,
                padding: "4px 8px",
                fontSize: 11,
                color: "#fff",
                background: "transparent",
              }}
              aria-label="Abrir en ventana separada"
            >
              Ventana
            </button>
          )}
          <button
            onClick={() => setTtsEnabled((v) => !v)}
            title={ttsEnabled ? "Desactivar lectura en voz alta" : "Activar lectura en voz alta"}
            style={{
              ...ghostBtn,
              background: ttsEnabled ? "rgba(255,255,255,0.24)" : "transparent",
            }}
            aria-label={ttsEnabled ? "Desactivar lectura en voz alta" : "Activar lectura en voz alta"}
          >
            {ttsEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          {isStreaming && stop && (
            <button
              type="button"
              onClick={() => stop()}
              title="Detener respuesta"
              style={{
                ...ghostBtn,
                background: "rgba(255,255,255,0.2)",
              }}
              aria-label="Detener respuesta"
            >
              <Square size={14} fill="currentColor" />
            </button>
          )}
          <button
            onClick={clear}
            title="Nueva conversación"
            style={ghostBtn}
            aria-label="Nueva conversación"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={onClose}
            title="Cerrar"
            style={ghostBtn}
            aria-label="Cerrar panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Messages ── */}
        <div
          ref={scrollContainerRef}
          role="log"
          aria-label="Conversación"
          aria-live="polite"
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            position: "relative",
          }}
        >
          {isEmpty && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                color: SUBTEXT,
                textAlign: "center",
                padding: "40px 20px",
              }}
            >
              <Avatar size={56} />
              <div style={{ fontWeight: 600, fontSize: 15, color: TEXT }}>
                ¡Hola! Soy Panelin
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                Te ayudo a cotizar paneles para tu obra. Contame qué necesitás.
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "center",
                  marginTop: 4,
                }}
              >
                {[
                  "Quiero cotizar un techo",
                  "¿Qué panel me recomendás?",
                  "Necesito una fachada",
                ].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => send(hint)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 20,
                      border: `1px solid ${BORDER}`,
                      background: SURFACE,
                      color: TEXT,
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: FONT,
                    }}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, msgIdx) => {
            const isUser = msg.role === "user";
            const prevUserMsg = !isUser
              ? [...messages].slice(0, msgIdx).reverse().find((m) => m.role === "user")
              : null;
            const prevQuestion = prevUserMsg?.content ?? "";
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: isUser ? "row-reverse" : "row",
                  alignItems: "flex-end",
                  gap: 8,
                }}
              >
                {!isUser && <Avatar size={24} />}
                <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 4 }}>
                  <div
                    style={{
                      padding: "10px 13px",
                      borderRadius: isUser
                        ? "16px 16px 4px 16px"
                        : "16px 16px 16px 4px",
                      background: isUser ? PRIMARY_COLOR : SURFACE_COLOR,
                      color: isUser ? USER_BUBBLE_TEXT_COLOR : ASSISTANT_BUBBLE_TEXT_COLOR,
                      fontSize: 14,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.pending && !msg.content ? (
                      <span>
                        <span className="panelin-dot" />
                        <span className="panelin-dot" />
                        <span className="panelin-dot" />
                      </span>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {/* Action feedback badges */}
                  {!isUser && msg.actions?.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 2 }}>
                      {msg.actions.map((a, i) => {
                        const labelFn = ACTION_LABELS[a.type];
                        const label = labelFn ? labelFn(a.payload) : a.type;
                        return (
                          <div key={i} style={{ fontSize: 11, color: "#34c759", display: "flex", alignItems: "center", gap: 3, fontFamily: FONT }}>
                            <span>✓</span><span>{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* TTS play button for assistant messages */}
                  {!isUser && msg.content && !msg.pending && (
                    <button
                      onClick={() => speakMessage(msg.content)}
                      title="Escuchar respuesta"
                      style={{
                        background: "none",
                        border: "none",
                        color: SUBTEXT,
                        cursor: "pointer",
                        padding: "2px 4px",
                        borderRadius: 4,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        fontSize: 11,
                        fontFamily: FONT,
                        alignSelf: "flex-start",
                      }}
                      aria-label="Escuchar respuesta"
                    >
                      <Volume2 size={12} /> Escuchar
                    </button>
                  )}
                  {/* Dev training buttons — only in devMode for assistant messages with content */}
                  {devMode && !isUser && msg.content && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 2 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => {
                            onSaveCorrection?.({ category: "conversational", question: prevQuestion, goodAnswer: msg.content, context: "rated-good" });
                          }}
                          style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: `1px solid ${BORDER}`, background: SURFACE, color: "#34c759", cursor: "pointer", fontFamily: FONT }}
                        >
                          ✓ Good
                        </button>
                        <button
                          onClick={() => {
                            setCorrectingMsgId(msg.id);
                            setCorrectionText("");
                          }}
                          style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: `1px solid ${BORDER}`, background: SURFACE, color: SUBTEXT, cursor: "pointer", fontFamily: FONT }}
                        >
                          ✗ Correct
                        </button>
                      </div>
                      {correctingMsgId === msg.id && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <textarea
                            value={correctionText}
                            onChange={(e) => setCorrectionText(e.target.value)}
                            placeholder="Respuesta correcta…"
                            rows={3}
                            style={{ fontSize: 12, padding: "6px 8px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fff", color: TEXT, fontFamily: FONT, resize: "vertical" }}
                          />
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              onClick={() => {
                                if (!correctionText.trim()) return;
                                onSaveCorrection?.({ category: "conversational", question: prevQuestion, badAnswer: msg.content, goodAnswer: correctionText.trim(), context: "" });
                                setCorrectingMsgId(null);
                                setCorrectionText("");
                              }}
                              style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: "none", background: PRIMARY, color: "#fff", cursor: "pointer", fontFamily: FONT }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => { setCorrectingMsgId(null); setCorrectionText(""); }}
                              style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: `1px solid ${BORDER}`, background: SURFACE, color: SUBTEXT, cursor: "pointer", fontFamily: FONT }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Error */}
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                fontSize: 12,
                color: "#ff3b30",
                textAlign: "center",
                padding: "4px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{error}</span>
              {retry && (
                <button
                  type="button"
                  onClick={() => retry()}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: `1px solid ${BORDER}`,
                    background: SURFACE,
                    color: PRIMARY,
                    cursor: "pointer",
                    fontFamily: FONT,
                  }}
                >
                  Reintentar
                </button>
              )}
            </div>
          )}

          {showScrollBtn && (
            <button
              type="button"
              onClick={scrollToBottom}
              style={{
                position: "sticky",
                bottom: 8,
                alignSelf: "center",
                fontSize: 11,
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${BORDER}`,
                background: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                color: PRIMARY,
                cursor: "pointer",
                fontFamily: FONT,
                zIndex: 2,
              }}
            >
              Ver últimos mensajes ↓
            </button>
          )}

          {/* Signature + skin selector: end of scroll area only (no fixed overlap with dev tools / page chrome) */}
          <div
            style={{
              position: "relative",
              marginTop: 28,
              paddingBottom: 8,
              flexShrink: 0,
              alignSelf: "flex-start",
              maxWidth: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            onMouseEnter={(e) => {
              const label = e.currentTarget.querySelector("[data-skin-hover-label]");
              if (label) {
                label.style.opacity = "1";
                label.style.transform = "translateX(0)";
              }
            }}
            onMouseLeave={(e) => {
              const label = e.currentTarget.querySelector("[data-skin-hover-label]");
              if (label) {
                label.style.opacity = "0";
                label.style.transform = "translateX(-6px)";
              }
            }}
          >
            <button
              type="button"
              onClick={() => setIsSkinMenuOpen((v) => !v)}
              title="Seleccionar skin"
              aria-label="Seleccionar skin"
              style={{
                width: 88,
                height: 176,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                opacity: 0.85,
                transition: "opacity 150ms ease, transform 150ms ease",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "flex-start",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "0.85";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundImage: `url(${typeof import.meta !== "undefined" ? import.meta.env?.BASE_URL ?? "/" : "/"}signature.png)`,
                  backgroundSize: "contain",
                  backgroundPosition: "center bottom",
                  backgroundRepeat: "no-repeat",
                  mixBlendMode: "multiply",
                  filter: "contrast(1.2) drop-shadow(0 1px 1px rgba(0,0,0,0.05))",
                }}
              />
            </button>
            <span
              data-skin-hover-label
              style={{
                fontSize: 11,
                color: SUBTEXT_COLOR,
                background: DRAWER_BG_COLOR,
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: 999,
                padding: "2px 8px",
                opacity: 0,
                transform: "translateX(-6px)",
                transition: "opacity 180ms ease, transform 180ms ease",
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
            >
              Seleccionar skin
            </span>
            {isSkinMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: "100%",
                  marginBottom: 8,
                  width: 240,
                  maxHeight: "min(70vh, 320px)",
                  overflowY: "auto",
                  background: DRAWER_BG_COLOR,
                  border: `1px solid ${BORDER_COLOR}`,
                  borderRadius: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.16)",
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  zIndex: 4,
                }}
              >
                {skinOptions.map((skin) => {
                  const active = skin.id === selectedSkinId;
                  const isBuiltin = BUILTIN_SKINS.some((b) => b.id === skin.id);
                  const isLocked = !!skin.locked || isBuiltin;
                  return (
                    <div key={skin.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => { setSelectedSkinId(skin.id); setIsSkinMenuOpen(false); }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                          padding: "7px 8px", borderRadius: 8,
                          border: `1px solid ${active ? PRIMARY_COLOR : BORDER_COLOR}`,
                          background: active ? SURFACE_COLOR : "transparent",
                          color: active ? PRIMARY_COLOR : TEXT_COLOR,
                          fontSize: 12, cursor: "pointer", textAlign: "left", fontFamily: FONT,
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{skin.name}</span>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: skin.tokens.primary, border: `1px solid ${skin.tokens.border}`, flexShrink: 0 }} />
                      </button>
                      {!isBuiltin && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button type="button" onClick={() => renameSkin(skin.id)} style={{ ...tinyActionBtn, borderColor: BORDER_COLOR, color: SUBTEXT_COLOR }} title="Renombrar skin">Ren</button>
                          <button type="button" onClick={() => toggleSkinLock(skin.id)} style={{ ...tinyActionBtn, borderColor: BORDER_COLOR, color: isLocked ? PRIMARY_COLOR : SUBTEXT_COLOR }} title={isLocked ? "Desbloquear skin" : "Bloquear skin"}>{isLocked ? "Lock" : "Open"}</button>
                          <button type="button" disabled={isLocked} onClick={() => deleteSkin(skin.id)} style={{ ...tinyActionBtn, borderColor: BORDER_COLOR, color: isLocked ? BORDER_COLOR : "#d11a2a", cursor: isLocked ? "not-allowed" : "pointer" }} title={isLocked ? "Skin bloqueada" : "Eliminar skin"}>Del</button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button type="button" onClick={saveCurrentSkin} style={{ marginTop: 2, padding: "7px 8px", borderRadius: 8, border: `1px dashed ${BORDER_COLOR}`, background: "transparent", color: SUBTEXT_COLOR, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
                  Guardar skin actual
                </button>
                <button type="button" onClick={() => { setSkinEditorOpen((v) => !v); setSkinDraft((prev) => ({ ...makeSkinDraftFromTokens(activeSkin.tokens), name: prev.name })); }} style={{ padding: "7px 8px", borderRadius: 8, border: `1px solid ${BORDER_COLOR}`, background: SURFACE_COLOR, color: TEXT_COLOR, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
                  {skinEditorOpen ? "Cerrar editor" : "Editor visual de skin"}
                </button>
                {skinEditorOpen && (
                  <div style={{ marginTop: 4, border: `1px solid ${BORDER_COLOR}`, borderRadius: 10, padding: 8, display: "grid", gap: 6 }}>
                    <input value={skinDraft.name} onChange={(e) => setSkinDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nombre de skin" style={{ border: `1px solid ${BORDER_COLOR}`, borderRadius: 8, padding: "6px 8px", fontSize: 12, fontFamily: FONT }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {[
                        ["brand", "Brand"], ["primary", "Primary"], ["surface", "Surface"], ["border", "Border"],
                        ["text", "Text"], ["subtext", "Subtext"], ["drawerBg", "Drawer BG"], ["headerText", "Header text"],
                        ["backdrop", "Backdrop"], ["userBubbleText", "User txt"], ["assistantBubbleText", "Assist txt"],
                      ].map(([key, label]) => (
                        <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, fontSize: 11, color: SUBTEXT_COLOR }}>
                          <span>{label}</span>
                          <div style={{ display: "flex", gap: 4, width: 100 }}>
                            <input type="text" value={skinDraft[key] || ""} onChange={(e) => setSkinDraft((prev) => ({ ...prev, [key]: e.target.value }))} style={{ flex: 1, border: `1px solid ${BORDER_COLOR}`, borderRadius: 4, padding: "2px 4px", fontSize: 10, minWidth: 0, background: DRAWER_BG_COLOR, color: TEXT_COLOR }} />
                            <div style={{ width: 16, height: 16, borderRadius: 4, border: "1px solid rgba(0,0,0,0.1)", background: skinDraft[key], flexShrink: 0 }} />
                          </div>
                        </label>
                      ))}
                    </div>
                    <button type="button" onClick={createSkinFromEditor} disabled={!skinDraft.name.trim()} style={{ padding: "7px 8px", borderRadius: 8, border: "none", background: skinDraft.name.trim() ? PRIMARY_COLOR : BORDER_COLOR, color: "#fff", fontSize: 12, cursor: skinDraft.name.trim() ? "pointer" : "not-allowed", fontFamily: FONT }}>
                      Crear skin
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input ── */}
        <div
          style={{
            position: "relative",
            borderTop: `1px solid ${BORDER}`,
            padding: "10px 12px",
            paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))",
            marginBottom: devMode ? devInputLift : 0,
            transition: "margin-bottom 120ms ease",
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            background: "#fff",
            flexShrink: 0,
          }}
        >
          {devMode && (
            <div
              onPointerDown={startInputLiftDrag}
              title="Arrastrar para mover bloque de input"
              style={{
                position: "absolute",
                left: "50%",
                top: -7,
                transform: "translateX(-50%)",
                width: 64,
                height: 12,
                borderRadius: 999,
                border: "1px solid rgba(0,113,227,0.28)",
                background: "linear-gradient(180deg, #f4f6ff, #d7e6ff)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                cursor: "ns-resize",
                touchAction: "none",
                zIndex: 2,
              }}
            />
          )}
          <button
            onClick={toggleListening}
            title={isListening ? "Escuchando..." : "Hablar"}
            style={{
              ...iconBtn,
              background: isListening ? "#ff3b30" : "transparent",
              color: isListening ? "#fff" : SUBTEXT,
              animation: isListening ? "panelin-mic-pulse 1.5s infinite" : "none",
            }}
            aria-label={isListening ? "Detener grabación" : "Hablar"}
          >
            <Mic size={18} />
          </button>
          <textarea
            id="panelin-chat-message"
            name="panelinMessage"
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Escribí tu consulta..."
            rows={1}
            disabled={isStreaming}
            aria-disabled={isStreaming}
            aria-label="Mensaje para Panelin"
            style={{
              flex: 1,
              resize: "none",
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: "8px 12px",
              fontSize: 14,
              fontFamily: FONT,
              lineHeight: 1.4,
              outline: "none",
              background: SURFACE,
              color: TEXT,
              minHeight: 36,
              maxHeight: 100,
              overflowY: "auto",
            }}
          />
          {isStreaming ? (
            <button
              onClick={stop}
              style={{ ...iconBtn, background: "#ff3b30", color: "#fff" }}
              aria-label="Detener generación"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              aria-disabled={!input.trim()}
              style={{
                ...iconBtn,
                background: input.trim() ? PRIMARY : BORDER,
                color: input.trim() ? "#fff" : SUBTEXT,
                cursor: input.trim() ? "pointer" : "not-allowed",
              }}
              aria-label="Enviar mensaje"
            >
              <Send size={16} />
            </button>
          )}
        </div>

        {devMode && (
          <PanelinDevPanel
            messages={messages}
            trainingEntries={trainingEntries}
            trainingStats={trainingStats}
            devMeta={devMeta}
            promptPreview={promptPreview}
            promptSections={promptSections}
            onSaveCorrection={onSaveCorrection}
            onReloadTrainingKB={onReloadTrainingKB}
            onReloadPromptPreview={onReloadPromptPreview}
            onReloadPromptSections={onReloadPromptSections}
            onSavePromptSection={onSavePromptSection}
            onVerifyCalculation={onVerifyCalculation}
          />
        )}
      </div>
    </>
  );
}

const ghostBtn = {
  background: "none",
  border: "none",
  color: "rgba(255,255,255,0.8)",
  cursor: "pointer",
  padding: 6,
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const iconBtn = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
  transition: "background 150ms ease",
};

const tinyActionBtn = {
  padding: "0 6px",
  height: 26,
  borderRadius: 7,
  border: "1px solid",
  background: "transparent",
  fontSize: 10,
  fontFamily: FONT,
  cursor: "pointer",
};
