/**
 * On-site Panelin dock for /logistica — American trucker skin, conversational.
 * HITL: never sends WhatsApp.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBmcAuthContext } from "../../contexts/bmcAuthContext.js";
import { useChat } from "../../hooks/useChat.js";
import {
  TRUCKER_ART_SRC,
  TRUCKER_NAME,
  buildLogisticaSnapshot,
  buildTruckerGreeting,
} from "../../utils/logistica/truckerAgent.js";
import {
  PERSONA_ACTION_TYPES,
  applyPersonaAction,
  loadTruckerPersona,
  saveTruckerPersona,
} from "../../utils/logistica/truckerPersona.js";
import "./logistica-trucker.css";

const OPEN_KEY = "bmc-logistica-trucker-open";

function readOpen() {
  try {
    const v = localStorage.getItem(OPEN_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export default function LogisticaTruckerAgent({
  info,
  stops,
  truckL,
  wizard,
  route,
  onApplyState,
  docked = false,
}) {
  const { accessToken } = useBmcAuthContext();
  const [open, setOpen] = useState(readOpen);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [persona, setPersona] = useState(() => saveTruckerPersona(loadTruckerPersona()));
  const listRef = useRef(null);
  const recRef = useRef(null);
  const fileRef = useRef(null);

  const snapshot = useMemo(
    () => buildLogisticaSnapshot({ info, stops, truckL, wizard, route, persona }),
    [info, stops, truckL, wizard, route, persona],
  );

  const greet = useMemo(() => buildTruckerGreeting(snapshot), [snapshot]);
  const artSrc = persona.artSrc || TRUCKER_ART_SRC;

  const onAction = useCallback(
    (action) => {
      if (action && PERSONA_ACTION_TYPES.includes(action.type)) {
        setPersona((prev) => {
          const out = applyPersonaAction(prev, action);
          if (!out.ok) return prev;
          return saveTruckerPersona(out.persona);
        });
        return;
      }
      if (!action || typeof onApplyState !== "function") return;
      onApplyState(action);
    },
    [onApplyState],
  );

  const chat = useChat({
    calcState: snapshot,
    onAction,
    persistHistory: false,
    operatorAccessToken: accessToken || "",
    conversationIdKey: "logistica-trucker-conversation-id",
  });

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.isStreaming, open]);

  const sendText = useCallback(
    (text) => {
      const t = String(text || "").trim();
      if (!t || chat.isStreaming) return;
      chat.send(t, { operatorContext: { surface: "panelin_chat", module: "logistica", envNo: snapshot.envNo } });
      setInput("");
    },
    [chat, snapshot.envNo],
  );

  const onPickArt = useCallback((ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const artSrcNext = String(reader.result || "");
      setPersona((prev) => saveTruckerPersona({ ...prev, artSrc: artSrcNext }));
    };
    reader.readAsDataURL(file);
  }, []);

  const toggleMic = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (listening && recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }
    const rec = new SR();
    rec.lang = "es-UY";
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const said = ev.results?.[0]?.[0]?.transcript;
      if (said) sendText(said);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [listening, sendText]);

  const bubbles = chat.messages.filter((m) => m.role === "user" || m.role === "assistant");
  const showGreet = bubbles.length === 0;

  return (
    <div className={`logi-trucker${docked ? " logi-trucker--docked" : ""}`} data-testid="logistica-trucker-agent">
      {open ? (
        <section
          className="logi-trucker__panel"
          role="dialog"
          aria-label={`${TRUCKER_NAME} logística`}
        >
          <header className="logi-trucker__head">
            <img src={artSrc} alt="" width={40} height={40} className="logi-trucker__face" />
            <div className="logi-trucker__who">
              <strong>{TRUCKER_NAME}</strong>
              <span>Tu logística · persistente en local</span>
            </div>
            <button type="button" className="logi-trucker__x" onClick={() => setOpen(false)} aria-label="Cerrar">
              ×
            </button>
          </header>
          <div className="logi-trucker__list" ref={listRef}>
            {showGreet ? (
              <div className="logi-trucker__bubble is-ai">{greet}</div>
            ) : null}
            {bubbles.map((m) => (
              <div key={m.id} className={`logi-trucker__bubble ${m.role === "user" ? "is-me" : "is-ai"}`}>
                {m.pending && !m.content ? "…" : m.content}
                {Array.isArray(m.suggestions?.groups) && m.suggestions.groups.length
                  ? m.suggestions.groups.flatMap((g) => g.items || []).slice(0, 6).map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        className="logi-trucker__chip"
                        onClick={() => {
                          chat.clearSuggestionsForMessage(m.id);
                          sendText(chip.send || chip.label);
                        }}
                      >
                        {chip.label}
                      </button>
                    ))
                  : null}
              </div>
            ))}
            {chat.error ? <div className="logi-trucker__err">{chat.error}</div> : null}
          </div>
          <form
            className="logi-trucker__form"
            onSubmit={(e) => {
              e.preventDefault();
              sendText(input);
            }}
          >
            <button
              type="button"
              className={`logi-trucker__mic${listening ? " is-on" : ""}`}
              onClick={toggleMic}
              aria-label="Hablar"
              title="Hablar"
            >
              Mic
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Calle, chofer, o «cambiá la forma / recordá esto»…"
              aria-label="Mensaje a Panelin"
              disabled={chat.isStreaming}
            />
            <button type="submit" disabled={chat.isStreaming || !input.trim()}>
              Enviar
            </button>
          </form>
        </section>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onPickArt}
      />
      <button
        type="button"
        className="logi-trucker__fab"
        onClick={() => setOpen((v) => !v)}
        onContextMenu={(e) => {
          e.preventDefault();
          fileRef.current?.click();
        }}
        aria-label={open ? "Ocultar Panelin" : "Abrir Panelin de ruta"}
        aria-expanded={open}
        title="Clic: abrir. Clic derecho: cambiar foto (queda guardada)"
      >
        <img src={artSrc} alt="" width={72} height={72} />
        {!open ? <span className="logi-trucker__fab-tip">{TRUCKER_NAME}</span> : null}
      </button>
    </div>
  );
}
