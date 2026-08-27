/**
 * Panelin Ruta — cara en la barra de /logistica; el chat vive en una ventana aparte
 * (popup, igual que Panelin Co-Work). HITL: never sends WhatsApp.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBmcAuthContext } from "../../contexts/bmcAuthContext.js";
import { useChat } from "../../hooks/useChat.js";
import { useVoiceSession } from "../../hooks/useVoiceSession.js";
import { openLogisticaAgentWindow } from "../../utils/logistica/openLogisticaAgentWindow.js";
import {
  TRUCKER_ART_LOOP_SRC,
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
import { formatTripPlanPreview } from "../../utils/logistica/tripPlanFormat.js";
import "./logistica-trucker.css";

function TruckerFace({ artSrc, className, size = 40 }) {
  const custom = Boolean(artSrc && artSrc !== TRUCKER_ART_SRC);
  if (!custom) {
    return (
      <video
        className={className}
        src={TRUCKER_ART_LOOP_SRC}
        poster={TRUCKER_ART_SRC}
        muted
        autoPlay
        loop
        playsInline
        width={size}
        height={size}
      />
    );
  }
  return <img src={artSrc} alt="" width={size} height={size} className={className} />;
}

export default function LogisticaTruckerAgent({
  info,
  stops,
  truckL,
  wizard,
  route,
  onApplyState,
  faceOnly = false,
  fill = false,
  pendingPlan = null,
  onProposePlan,
  onApplyPendingPlan,
  onDismissPlan,
}) {
  const { accessToken } = useBmcAuthContext();
  const [input, setInput] = useState("");
  const [persona, setPersona] = useState(() => saveTruckerPersona(loadTruckerPersona()));
  const listRef = useRef(null);
  const fileRef = useRef(null);

  const snapshot = useMemo(
    () => buildLogisticaSnapshot({ info, stops, truckL, wizard, route, persona }),
    [info, stops, truckL, wizard, route, persona],
  );
  const greet = useMemo(() => buildTruckerGreeting(snapshot), [snapshot]);
  const artSrc = persona.artSrc || TRUCKER_ART_SRC;

  const onAction = useCallback(
    (action) => {
      if (!action || typeof action !== "object") return;
      if (action.type === "proposeTripPlan") {
        onProposePlan?.();
        return;
      }
      if (PERSONA_ACTION_TYPES.includes(action.type)) {
        setPersona((prev) => {
          const out = applyPersonaAction(prev, action);
          if (!out.ok) return prev;
          return saveTruckerPersona(out.persona);
        });
        return;
      }
      if (typeof onApplyState !== "function") return;
      onApplyState(action);
    },
    [onApplyState, onProposePlan],
  );

  const chat = useChat({
    calcState: snapshot,
    onAction,
    persistHistory: false,
    operatorAccessToken: accessToken || "",
    conversationIdKey: "logistica-trucker-conversation-id",
  });

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chat.messages, chat.isStreaming]);

  const sendText = useCallback(
    (text) => {
      const t = String(text || "").trim();
      if (!t || chat.isStreaming) return;
      chat.send(t, { operatorContext: { surface: "panelin_chat", module: "logistica", envNo: snapshot.envNo } });
      setInput("");
    },
    [chat, snapshot.envNo],
  );

  const voice = useVoiceSession({
    onAction,
    authHeader: accessToken ? `Bearer ${accessToken}` : undefined,
    voiceProvider: "grok",
    aiProvider: "grok",
    surface: "logistica",
  });

  const toggleMic = useCallback(() => {
    if (voice.status === "active" || voice.status === "connecting") {
      voice.stop();
      return;
    }
    void voice.start(snapshot);
  }, [voice, snapshot]);

  const onPickArt = useCallback((ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPersona((prev) => saveTruckerPersona({ ...prev, artSrc: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  }, []);

  const openPopup = useCallback(() => {
    void openLogisticaAgentWindow({ draft: snapshot.envNo });
  }, [snapshot.envNo]);

  if (faceOnly) {
    return (
      <div className="logi-trucker logi-trucker--header" data-testid="logistica-trucker-agent">
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickArt} />
        <button
          type="button"
          className="logi-trucker__fab"
          onClick={openPopup}
          onContextMenu={(e) => {
            e.preventDefault();
            fileRef.current?.click();
          }}
          aria-label={`Abrir ${TRUCKER_NAME} encima de logística`}
          title="Clic: queda encima de logística. Clic derecho: foto"
        >
          <TruckerFace artSrc={artSrc} size={74} />
        </button>
      </div>
    );
  }

  const bubbles = chat.messages.filter((m) => m.role === "user" || m.role === "assistant");
  const showGreet = bubbles.length === 0;

  return (
    <section
      className={`logi-trucker__panel${fill ? " logi-trucker__panel--fill" : ""}`}
      data-testid="logistica-trucker-chat"
      aria-label={`${TRUCKER_NAME} logística`}
    >
      <header className="logi-trucker__head">
        <TruckerFace artSrc={artSrc} className="logi-trucker__face" size={140} />
        <div className="logi-trucker__who">
          <strong>{TRUCKER_NAME}</strong>
          <span>Tu logística · ventana aparte</span>
        </div>
      </header>
      <div className="logi-trucker__list" ref={listRef}>
        {showGreet ? <div className="logi-trucker__bubble is-ai">{greet}</div> : null}
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
        {voice.status === "error" ? (
          <div className="logi-trucker__err">Voz Grok: no se pudo iniciar (¿token xAI / API :3002?)</div>
        ) : null}
        {pendingPlan ? (
          <div className="logi-trucker__bubble is-ai" data-testid="logistica-trip-plan-preview">
            {formatTripPlanPreview(pendingPlan)}
            {pendingPlan.status === "ok" ? (
              <>
                <button type="button" className="logi-trucker__chip" onClick={() => onApplyPendingPlan?.()}>
                  Aplicar
                </button>
                <button type="button" className="logi-trucker__chip" onClick={() => onDismissPlan?.()}>
                  No
                </button>
              </>
            ) : (
              <button type="button" className="logi-trucker__chip" onClick={() => onDismissPlan?.()}>
                Entendido
              </button>
            )}
          </div>
        ) : null}
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
          className={`logi-trucker__mic${voice.status === "active" || voice.isListening ? " is-on" : ""}`}
          onClick={toggleMic}
          aria-label="Micrófono Grok Voice"
          title={voice.status === "active" ? "Cortar voz Grok" : "Hablar con El Transportador (Grok Voice)"}
        >
          {voice.status === "connecting" ? "…" : "Mic"}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Calle, chofer, o «cambiá la forma / recordá esto»…"
          aria-label="Mensaje a Panelin"
          disabled={chat.isStreaming}
        />
        <button
          type="button"
          className="logi-trucker__chip"
          onClick={() => onProposePlan?.()}
          disabled={chat.isStreaming}
        >
          Proponé el plan
        </button>
        <button type="submit" disabled={chat.isStreaming || !input.trim()}>
          Enviar
        </button>
      </form>
    </section>
  );
}
