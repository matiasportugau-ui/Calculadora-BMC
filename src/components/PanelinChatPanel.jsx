import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X, RotateCcw, Send, Mic, Volume2, VolumeX, Square, Radio, Search, Palette } from "lucide-react";
import PanelinDevPanel from "./PanelinDevPanel.jsx";
import PanelinVoicePanel from "./PanelinVoicePanel.jsx";
import TrustBlock from "./panelin/TrustBlock.jsx";
import { useDictation } from "../hooks/useDictation.js";
import PanelinCharacter from "./PanelinCharacter.jsx";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Helvetica, Arial, sans-serif";
const PRIMARY = "#0071e3";
const SURFACE = "#f5f5f7";
const BORDER = "#e5e5ea";
const TEXT = "#1d1d1f";
const SUBTEXT = "#6e6e73";
const STORAGE_SELECTED_SKIN = "panelin-chat-selected-skin-v1";
const STORAGE_CUSTOM_SKINS = "panelin-chat-custom-skins-v1";
const BUILTIN_SKINS = [
  {
    id: "applied-ai",
    name: "Applied AI",
    tokens: {
      brand: "#1F1B16",
      primary: "#C96442",
      surface: "#FAF9F6",
      border: "#E8E4DD",
      text: "#1F1B16",
      subtext: "#6B645B",
      drawerBg: "#FFFFFF",
      backdrop: "rgba(31,27,22,0.32)",
      headerText: "#1F1B16",
      userBubbleText: "#1F1B16",
      assistantBubbleText: "#1F1B16",
    },
  },
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
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const TTS_SPEED_KEY = "panelin-tts-speed";
const TTS_SPEED_MIN = 0.75;
const TTS_SPEED_MAX = 1.35;
const TTS_SPEED_DEFAULT = 1.0;

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

/**
 * Panelin AI chat drawer.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   messages: Array<{id:string, role:string, content:string, pending?:boolean, suggestions?: { groups?: Array<{ title?: string, items: Array<{ label: string, send?: string }> }> }}>,
 *   isStreaming: boolean,
 *   send: (text:string) => void,
 *   clearSuggestionsForMessage?: (messageId: string) => void,
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
 *   onBulkDeleteKB?: (ids: string[]) => Promise<void>,
 *   onBulkArchiveKB?: (ids: string[]) => Promise<void>,
 *   onLoadConversations?: (opts?: object) => Promise<object>,
 *   onLoadConversationAnalysis?: (convId: string) => Promise<object>,
 *   detachedMode?: boolean,
 *   embeddedMode?: boolean,
 *   floatingMode?: boolean,
 *   onRequestFloating?: () => void,
 *   onReturnToSidebar?: () => void,
 *   onHeaderPointerDown?: (e: import('react').PointerEvent) => void,
 *   onOpenDetachedWindow?: () => void,
 *   calcState?: object,
 *   onChatAction?: (action: object) => void,
 *   authHeader?: string,
 * }} props
 */
export default function PanelinChatPanel({
  isOpen,
  onClose,
  messages,
  isStreaming,
  send,
  clearSuggestionsForMessage,
  stop,
  retry,
  clear,
  error,
  devMode = false,
  onToggleDevMode,
  devMeta,
  trainingEntries,
  trainingStats,
  promptPreview,
  promptSections,
  onSaveCorrection,
  onSendFeedback,
  onReloadTrainingKB,
  onReloadPromptPreview,
  onReloadPromptSections,
  onSavePromptSection,
  onVerifyCalculation,
  onBulkDeleteKB,
  onBulkArchiveKB,
  onLoadConversations,
  onLoadConversationAnalysis,
  detachedMode = false,
  embeddedMode = false,
  floatingMode = false,
  onRequestFloating,
  onReturnToSidebar,
  onHeaderPointerDown,
  onOpenDetachedWindow,
  calcState,
  onChatAction,
  authHeader,
}) {
  const [isSkinMenuOpen, setIsSkinMenuOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [customSkins, setCustomSkins] = useState(() => loadCustomSkins());
  const [skinEditorOpen, setSkinEditorOpen] = useState(false);
  const [skinDraft, setSkinDraft] = useState(() => makeSkinDraftFromTokens(BUILTIN_SKINS[0].tokens));
  const [selectedSkinId, setSelectedSkinId] = useState(() => {
    if (typeof window === "undefined") return "classic";
    return localStorage.getItem(STORAGE_SELECTED_SKIN) || "applied-ai";
  });
  const [input, setInput] = useState("");
  const [correctingMsgId, setCorrectingMsgId] = useState(null);
  const [correctionText, setCorrectionText] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(() => {
    if (typeof window === "undefined") return TTS_SPEED_DEFAULT;
    const raw = Number(sessionStorage.getItem(TTS_SPEED_KEY));
    return Number.isFinite(raw) ? clamp(raw, TTS_SPEED_MIN, TTS_SPEED_MAX) : TTS_SPEED_DEFAULT;
  });
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
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
  const lastAutoSpokenMsgIdRef = useRef(null);
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
  const activeSkin = skinMap.get(selectedSkinId) || skinMap.get("applied-ai") || BUILTIN_SKINS[0];
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(TTS_SPEED_KEY, String(ttsSpeed));
  }, [ttsSpeed]);

  const speakWithReaction = useCallback((text) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-UY";
      utterance.rate = ttsSpeed;
      const voices = window.speechSynthesis.getVoices();
      const esVoice = voices.find((v) => v.lang.startsWith("es"));
      if (esVoice) utterance.voice = esVoice;
      utterance.onstart = () => setIsTtsSpeaking(true);
      utterance.onend = () => setIsTtsSpeaking(false);
      utterance.onerror = () => setIsTtsSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) speak();
    else window.speechSynthesis.addEventListener("voiceschanged", speak, { once: true });
  }, [ttsSpeed]);

  // 2.2 — Focus trap: keep Tab/Shift+Tab inside drawer (skip in embedded sidebar)
  const drawerRef = useRef(null);
  useEffect(() => {
    if (!isOpen || embeddedMode) return;
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
  }, [isOpen, embeddedMode]);

  // TTS: read assistant messages once they finish streaming.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!ttsEnabled) {
      if (last?.role === "assistant" && last.content && !last.pending) {
        lastAutoSpokenMsgIdRef.current = last.id;
      }
      return;
    }
    if (!last || last.role !== "assistant" || !last.content || last.pending) return;
    if (lastAutoSpokenMsgIdRef.current === last.id) return;
    lastAutoSpokenMsgIdRef.current = last.id;
    speakWithReaction(last.content);
  }, [messages, ttsEnabled, speakWithReaction]);

  // Voice dictation: browser-native SpeechRecognition (free, no key) when
  // available, falling back to server Whisper. The hook manages the mic stream
  // lifecycle internally; cleanup happens on unmount.
  const dictation = useDictation({
    onTranscript: (text) => {
      const trimmed = String(text || "").trim();
      if (!trimmed) return;
      // Append to existing input so the user can speak in pieces or edit between captures
      setInput((prev) => (prev ? `${prev.trimEnd()} ${trimmed}` : trimmed));
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    onError: (msg) => {
      // Surface error inline; the user can also see it in the mic-button title attribute
      console.warn("[dictation]", msg);
    },
    language: "es",
    preferBrowserSpeech: true,
  });
  const isListening = dictation.status === "recording";
  const isTranscribing = dictation.status === "transcribing";

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
    speakWithReaction(text);
  }, [speakWithReaction]);

  // Mic button toggles dictation: idle → record, record → stop+transcribe.
  // Browser SpeechRecognition (Chrome/Edge/Safari) when available — free and
  // key-less; falls back to server Whisper for browsers without it (Firefox).
  const toggleListening = useCallback(() => {
    if (dictation.status === "recording") {
      dictation.stop();
    } else if (dictation.status === "idle" || dictation.status === "error") {
      if (dictation.status === "error") dictation.reset();
      dictation.start();
    }
    // While transcribing, the button is disabled (handled in the JSX below).
  }, [dictation]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    send(text);
  }, [input, isStreaming, send]);

  const [deepResearch, setDeepResearch] = useState({ status: "idle", id: null, error: null });
  const deepResearchPollRef = useRef(null);
  useEffect(() => () => {
    if (deepResearchPollRef.current) clearInterval(deepResearchPollRef.current);
  }, []);

  const handleDeepResearch = useCallback(async () => {
    const query = input.trim();
    if (!query || deepResearch.status === "running") return;
    setDeepResearch({ status: "running", id: null, error: null });
    try {
      const res = await fetch("/api/research/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const id = data.id;
      setDeepResearch({ status: "running", id, error: null });
      deepResearchPollRef.current = setInterval(async () => {
        try {
          const pr = await fetch(`/api/research/deep/${encodeURIComponent(id)}`);
          const pdata = await pr.json();
          if (pdata.status === "completed") {
            clearInterval(deepResearchPollRef.current);
            deepResearchPollRef.current = null;
            const cites = (pdata.citations || [])
              .map((c, i) => `[${i + 1}] ${c.title || c.url} — ${c.url}`)
              .join("\n");
            const body = `🔎 Deep Research: "${query}"\n\n${pdata.text || "(sin texto)"}${cites ? `\n\nFuentes:\n${cites}` : ""}`;
            setInput(body);
            setDeepResearch({ status: "done", id, error: null });
          } else if (pdata.status === "failed" || pdata.status === "cancelled") {
            clearInterval(deepResearchPollRef.current);
            deepResearchPollRef.current = null;
            setDeepResearch({ status: "error", id, error: pdata.error?.message || pdata.status });
          }
        } catch (err) {
          clearInterval(deepResearchPollRef.current);
          deepResearchPollRef.current = null;
          setDeepResearch({ status: "error", id, error: err.message });
        }
      }, 5000);
    } catch (err) {
      setDeepResearch({ status: "error", id: null, error: err.message });
    }
  }, [input, deepResearch.status]);

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

  const exportSkins = () => {
    if (customSkins.length === 0) {
      window.alert("No hay skins personalizadas para exportar.");
      return;
    }
    const blob = new Blob([JSON.stringify(customSkins, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "panelin-skins.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const importSkinsRef = useRef(null);
  const handleImportSkins = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed)) throw new Error("Formato inválido");
        const valid = parsed.filter((s) => s && s.id && s.name && s.tokens);
        if (valid.length === 0) throw new Error("No se encontraron skins válidas");
        let importedCount = 0;
        let skippedCount = 0;
        setCustomSkins((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const toAdd = valid.filter((s) => !existingIds.has(s.id));
          importedCount = toAdd.length;
          skippedCount = valid.length - importedCount;
          const merged = [...prev, ...toAdd];
          saveCustomSkins(merged);
          return merged;
        });
        const skippedMsg = skippedCount > 0 ? ` (${skippedCount} omitidas por id duplicado).` : ".";
        window.alert(`${importedCount} skin(s) importadas correctamente${skippedMsg}`);
      } catch (err) {
        window.alert(`Error al importar skins: ${err.message}`);
      }
    };
    reader.readAsText(file);
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
  const isInPageLayout = embeddedMode || floatingMode;
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
      {/* Backdrop — overlay drawer only (not embedded/floating/detached) */}
      {!isInPageLayout && (
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
      )}

      {/* Drawer / embedded / floating host */}
      <div
        ref={drawerRef}
        role={embeddedMode ? "complementary" : "dialog"}
        aria-label="Panelin Asistente BMC"
        aria-modal={embeddedMode ? undefined : "true"}
        style={{
          position: isInPageLayout ? "relative" : "fixed",
          top: isInPageLayout ? undefined : 0,
          right: isInPageLayout ? undefined : (detachedMode ? "auto" : 0),
          left: isInPageLayout ? undefined : (detachedMode ? 0 : "auto"),
          height: isInPageLayout ? "100%" : "100dvh",
          zIndex: isInPageLayout ? undefined : 300,
          width: "100%",
          maxWidth: isInPageLayout ? "100%" : (detachedMode ? "100%" : drawerMaxWidth),
          background: DRAWER_BG_COLOR,
          boxShadow: isInPageLayout || detachedMode ? "none" : "-4px 0 32px rgba(0,0,0,0.18)",
          display: isInPageLayout ? (isOpen ? "flex" : "none") : "flex",
          flexDirection: "column",
          transform: isInPageLayout
            ? "none"
            : (detachedMode ? "translateX(0)" : (isOpen ? "translateX(0)" : "translateX(100%)")),
          transition: isInPageLayout || detachedMode ? "none" : "transform 280ms cubic-bezier(0.4,0,0.2,1)",
          fontFamily: FONT,
          willChange: isInPageLayout ? undefined : "transform",
          minHeight: 0,
          minWidth: 0,
        }}
      >
        {devMode && !detachedMode && (
          <div
            onPointerDown={startDrawerResize}
            title="Arrastrar para redimensionar panel"
            style={{
              position: "absolute",
              left: -4,
              top: 0,
              width: 8,
              height: "100%",
              borderLeft: "2px solid transparent",
              background: "transparent",
              cursor: "ew-resize",
              touchAction: "none",
              zIndex: 5,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderLeftColor = "rgba(0,113,227,0.45)";
              e.currentTarget.style.background =
                "linear-gradient(to right, rgba(0,113,227,0.12), transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderLeftColor = "transparent";
              e.currentTarget.style.background = "transparent";
            }}
          />
        )}
        {/* ── Header ── */}
        <div
          onPointerDown={floatingMode ? onHeaderPointerDown : undefined}
          style={{
            background: BRAND_COLOR,
            color: HEADER_TEXT_COLOR,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
            cursor: floatingMode ? "grab" : undefined,
            touchAction: floatingMode ? "none" : undefined,
          }}
        >
          <PanelinCharacter
            size={36}
            isSpeaking={isTtsSpeaking}
            isThinking={isStreaming && !isTtsSpeaking}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Panelin</div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              Asistente BMC Uruguay{devMode ? " · Developer Mode" : ""}
            </div>
          </div>
          {embeddedMode && !floatingMode && onRequestFloating && (
            <button
              type="button"
              data-no-drag
              onClick={onRequestFloating}
              title="Flotar chat"
              style={{
                ...ghostBtn,
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 999,
                padding: "4px 8px",
                fontSize: 11,
                color: "#fff",
              }}
              aria-label="Flotar chat"
            >
              Flotar
            </button>
          )}
          {floatingMode && onReturnToSidebar && (
            <button
              type="button"
              data-no-drag
              onClick={onReturnToSidebar}
              title="Volver al panel lateral"
              style={{
                ...ghostBtn,
                border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 999,
                padding: "4px 8px",
                fontSize: 11,
                color: "#fff",
              }}
              aria-label="Volver a sidebar"
            >
              Volver a sidebar
            </button>
          )}
          {onToggleDevMode && (
            <button
              data-no-drag
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
              data-no-drag
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
            data-no-drag
            onClick={() => setVoiceMode((v) => !v)}
            title={voiceMode ? "Volver a modo texto" : "Modo voz fluido (OpenAI Realtime)"}
            style={{
              ...ghostBtn,
              background: voiceMode ? "rgba(255,255,255,0.24)" : "transparent",
            }}
            aria-label={voiceMode ? "Volver a modo texto" : "Activar modo voz"}
          >
            <Radio size={15} />
          </button>
          {!voiceMode && (
          <button
            data-no-drag
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
          )}
          {ttsEnabled && !voiceMode && (
            <div
              data-no-drag
              style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
              title={`Velocidad TTS: ${ttsSpeed.toFixed(2)}×`}
            >
              <span style={{ fontSize: 10, opacity: 0.75, whiteSpace: "nowrap" }}>Vel.</span>
              <input
                type="range"
                min={TTS_SPEED_MIN}
                max={TTS_SPEED_MAX}
                step={0.05}
                value={ttsSpeed}
                onChange={(e) => setTtsSpeed(clamp(Number(e.target.value), TTS_SPEED_MIN, TTS_SPEED_MAX))}
                aria-label="Velocidad de lectura en voz alta"
                style={{ width: 68, accentColor: "#fff" }}
              />
            </div>
          )}
          {isStreaming && stop && (
            <button
              type="button"
              data-no-drag
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
            data-no-drag
            onClick={clear}
            title="Nueva conversación"
            style={ghostBtn}
            aria-label="Nueva conversación"
          >
            <RotateCcw size={15} />
          </button>
          <button
            data-no-drag
            onClick={onClose}
            title="Cerrar"
            style={ghostBtn}
            aria-label="Cerrar panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Voice Mode — panel stays mounted; the WebRTC session is torn down when voiceMode flips off ── */}
        <div style={{ display: voiceMode ? "flex" : "none", flex: 1, flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          <PanelinVoicePanel
            calcState={calcState}
            onAction={onChatAction}
            onSwitchToText={() => setVoiceMode(false)}
            skinTokens={activeTokens}
            devMode={devMode}
            authHeader={authHeader}
            voiceMode={voiceMode}
            send={send}
            messages={messages}
          />
        </div>

        {/* ── Messages ── */}
        {!voiceMode && <div
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
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                color: SUBTEXT,
                textAlign: "center",
                padding: "8px 20px 24px",
              }}
            >
              <PanelinCharacter size={56} isThinking={isStreaming} />
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
                {!isUser && (
                  <PanelinCharacter
                    size={24}
                    isSpeaking={isTtsSpeaking && msgIdx === messages.length - 1}
                    isThinking={isStreaming && msg.pending && msgIdx === messages.length - 1}
                    staticAvatar
                  />
                )}
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
                  {/* Tool-call indicators (shown in devMode or as subtle pills) */}
                  {!isUser && msg.toolCalls?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 2 }}>
                      {msg.toolCalls.map((tc, i) => (
                        <div key={i} style={{ fontSize: 10, color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 6, padding: "1px 7px", display: "flex", alignItems: "center", gap: 3, fontFamily: FONT }}>
                          <span style={{ color: "#8b5cf6" }}>⚙</span>
                          <span>{tc.tool}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Trust UI: cifras verificadas por el cotizador */}
                  {!isUser && msg.verifiedQuote && (
                    <TrustBlock verifiedQuote={msg.verifiedQuote} />
                  )}
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
                  {/* Quick replies from SUGGEST_JSON (server SSE) */}
                  {!isUser && Array.isArray(msg.suggestions?.groups) && msg.suggestions.groups.length > 0 && !msg.pending && (
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 2, maxWidth: "100%" }}
                      role="group"
                      aria-label="Respuestas sugeridas"
                    >
                      {msg.suggestions.groups.map((g, gi) => (
                        <div key={gi}>
                          {g.title && (
                            <div style={{ fontSize: 11, color: SUBTEXT_COLOR, marginBottom: 4, fontWeight: 600, fontFamily: FONT }}>
                              {g.title}
                            </div>
                          )}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {(g.items || []).map((it, ii) => (
                              <button
                                key={`${gi}-${ii}`}
                                type="button"
                                disabled={isStreaming}
                                onClick={() => {
                                  const text = String(it.send || it.label || "").trim();
                                  if (!text) return;
                                  clearSuggestionsForMessage?.(msg.id);
                                  send(text);
                                }}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 20,
                                  border: `1px solid ${BORDER_COLOR}`,
                                  background: SURFACE_COLOR,
                                  color: TEXT_COLOR,
                                  fontSize: 12,
                                  cursor: isStreaming ? "not-allowed" : "pointer",
                                  fontFamily: FONT,
                                  opacity: isStreaming ? 0.55 : 1,
                                  maxWidth: "100%",
                                  textAlign: "left",
                                }}
                              >
                                {it.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
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
                  {/* Feedback buttons — visible for all users on assistant messages */}
                  {!isUser && msg.content && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 2 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={() => {
                            onSendFeedback?.({ question: prevQuestion, generatedText: msg.content, rating: "good" });
                            if (devMode) onSaveCorrection?.({ category: "conversational", question: prevQuestion, goodAnswer: msg.content, context: "rated-good" });
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
                                onSendFeedback?.({ question: prevQuestion, generatedText: msg.content, rating: "edit", correction: correctionText.trim() });
                                if (devMode) onSaveCorrection?.({ category: "conversational", question: prevQuestion, badAnswer: msg.content, goodAnswer: correctionText.trim(), context: "" });
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

          {/* Skin selector — oculto en empty state (evita bloque signature.png roto) */}
          {!isEmpty && (
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
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${BORDER_COLOR}`,
                background: SURFACE_COLOR,
                padding: 0,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: SUBTEXT_COLOR,
              }}
            >
              <Palette size={16} />
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
                <div style={{ display: "flex", gap: 4 }}>
                  <button type="button" onClick={exportSkins} style={{ flex: 1, padding: "7px 8px", borderRadius: 8, border: `1px solid ${BORDER_COLOR}`, background: SURFACE_COLOR, color: TEXT_COLOR, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
                    Exportar skins
                  </button>
                  <button type="button" onClick={() => importSkinsRef.current?.click()} style={{ flex: 1, padding: "7px 8px", borderRadius: 8, border: `1px solid ${BORDER_COLOR}`, background: SURFACE_COLOR, color: TEXT_COLOR, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>
                    Importar skins
                  </button>
                  <input ref={importSkinsRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={handleImportSkins} />
                </div>
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
          )}

          <div ref={messagesEndRef} />
        </div>}

        {/* ── Input ── */}
        {!voiceMode && <div
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
            disabled={isTranscribing}
            title={
              isTranscribing
                ? "Transcribiendo…"
                : isListening
                  ? "Tocá para detener y transcribir"
                  : dictation.error
                    ? `Error: ${dictation.error}`
                    : "Hablar (Whisper)"
            }
            style={{
              ...iconBtn,
              background: isListening ? "#ff3b30" : isTranscribing ? PRIMARY : "transparent",
              color: isListening || isTranscribing ? "#fff" : SUBTEXT,
              animation: isListening ? "panelin-mic-pulse 1.5s infinite" : "none",
              opacity: isTranscribing ? 0.7 : 1,
              cursor: isTranscribing ? "wait" : "pointer",
            }}
            aria-label={isTranscribing ? "Transcribiendo" : isListening ? "Detener grabación" : "Hablar"}
            aria-busy={isTranscribing}
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
          <button
            onClick={handleDeepResearch}
            disabled={!input.trim() || deepResearch.status === "running"}
            title={
              deepResearch.status === "running"
                ? "Investigando…"
                : deepResearch.status === "error"
                  ? `Error: ${deepResearch.error}`
                  : "Deep Research (OpenAI)"
            }
            style={{
              ...iconBtn,
              background: deepResearch.status === "running" ? "#f59e0b" : BORDER,
              color: deepResearch.status === "running" ? "#fff" : SUBTEXT,
              cursor: input.trim() && deepResearch.status !== "running" ? "pointer" : "not-allowed",
            }}
            aria-label="Deep Research"
          >
            <Search size={14} />
          </button>
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
        </div>}

        {devMode && (
          <PanelinDevPanel
            skinTokens={activeTokens}
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
            onBulkDeleteKB={onBulkDeleteKB}
            onBulkArchiveKB={onBulkArchiveKB}
            onLoadConversations={onLoadConversations}
            onLoadConversationAnalysis={onLoadConversationAnalysis}
          />
        )}
      </div>
    </>
  );
}

const ghostBtn = {
  position: "relative",
  zIndex: 2,
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
