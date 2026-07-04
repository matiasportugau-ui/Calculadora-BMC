/**
 * PanelinCharacter — reusable video avatar with restrained motion cues.
 * Used as the external header trigger (chat closed) and inside the chat panel.
 */
import { useEffect, useId, useRef, useState } from "react";
import { PANELIN_AGENT_VIDEO_SRC } from "../utils/panelinAgentVideoSrc.js";

const GREET_LINES = [
  "¿Cotizamos?",
  "Hacé clic para chatear",
  "Te ayudo con tu obra",
];

const STYLE_ID = "panelin-character-keyframes";

function ensureKeyframes() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes panelin-idle-breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.04); }
    }
    @keyframes panelin-talking-ring {
      0%, 100% { box-shadow: 0 0 0 0 rgba(0, 113, 227, 0.45); }
      50% { box-shadow: 0 0 0 6px rgba(0, 113, 227, 0); }
    }
    @keyframes panelin-thinking-ring {
      0%, 100% { box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.4); }
      50% { box-shadow: 0 0 0 5px rgba(167, 139, 250, 0); }
    }
    @keyframes panelin-greet-pop {
      0% { opacity: 0; transform: translateY(4px) scale(0.96); }
      12%, 82% { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-2px) scale(0.98); }
    }
  `;
  document.head.appendChild(s);
}

/**
 * @param {{
 *   size?: number,
 *   onClick?: () => void,
 *   isSpeaking?: boolean,
 *   isThinking?: boolean,
 *   showGreet?: boolean,
 *   title?: string,
 *   className?: string,
 *   "aria-label"?: string,
 * }} props
 */
export default function PanelinCharacter({
  size = 48,
  onClick,
  isSpeaking = false,
  isThinking = false,
  showGreet = false,
  title,
  className,
  "aria-label": ariaLabel = "Abrir asistente Panelin",
}) {
  const greetId = useId();
  const [videoFailed, setVideoFailed] = useState(false);
  const [greetVisible, setGreetVisible] = useState(false);
  const [greetText, setGreetText] = useState(GREET_LINES[0]);
  const greetIndexRef = useRef(0);
  const greetTimerRef = useRef(null);
  const greetHideRef = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => {
    ensureKeyframes();
  }, []);

  useEffect(() => {
    busyRef.current = isSpeaking || isThinking;
  }, [isSpeaking, isThinking]);

  useEffect(() => {
    if (!showGreet || onClick == null) return undefined;

    const queueNext = () => {
      const delay = 45000 + Math.random() * 45000;
      greetTimerRef.current = window.setTimeout(() => {
        if (busyRef.current) {
          queueNext();
          return;
        }
        greetIndexRef.current = (greetIndexRef.current + 1) % GREET_LINES.length;
        setGreetText(GREET_LINES[greetIndexRef.current]);
        setGreetVisible(true);
        greetHideRef.current = window.setTimeout(() => {
          setGreetVisible(false);
          queueNext();
        }, 4200);
      }, delay);
    };

    const initial = window.setTimeout(() => {
      if (busyRef.current) {
        queueNext();
        return;
      }
      setGreetText(GREET_LINES[0]);
      setGreetVisible(true);
      greetHideRef.current = window.setTimeout(() => {
        setGreetVisible(false);
        queueNext();
      }, 4200);
    }, 8000);

    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(greetTimerRef.current);
      window.clearTimeout(greetHideRef.current);
    };
  }, [showGreet, onClick]);

  const ringAnimation = isSpeaking
    ? "panelin-talking-ring 1.2s ease-in-out infinite"
    : isThinking
      ? "panelin-thinking-ring 1.6s ease-in-out infinite"
      : "none";

  const breatheAnimation = !isSpeaking && !isThinking
    ? "panelin-idle-breathe 3.6s ease-in-out infinite"
    : "none";

  const interactive = typeof onClick === "function";
  const Wrapper = interactive ? "button" : "div";

  const avatar = videoFailed ? (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: "#1a3a5c",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(11, Math.round(size * 0.36)),
        fontWeight: 700,
      }}
    >
      P
    </div>
  ) : (
    <video
      src={PANELIN_AGENT_VIDEO_SRC}
      autoPlay
      muted
      loop
      playsInline
      onError={() => setVideoFailed(true)}
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        background: "#1a3a5c",
        border: "2px solid rgba(255,255,255,0.35)",
        animation: `${breatheAnimation}${ringAnimation !== "none" ? `, ${ringAnimation}` : ""}`,
      }}
    />
  );

  return (
    <Wrapper
      type={interactive ? "button" : undefined}
      onClick={onClick}
      title={title || (interactive ? "Abrir Panelin" : undefined)}
      aria-label={interactive ? ariaLabel : undefined}
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        margin: 0,
        border: "none",
        background: "transparent",
        cursor: interactive ? "pointer" : "default",
        flexShrink: 0,
      }}
    >
      {avatar}
      {showGreet && greetVisible && (
        <span
          id={greetId}
          role="status"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            background: "rgba(15,23,42,0.92)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            padding: "5px 10px",
            borderRadius: 8,
            boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
            pointerEvents: "none",
            animation: "panelin-greet-pop 4.2s ease forwards",
            zIndex: 2,
          }}
        >
          {greetText}
        </span>
      )}
    </Wrapper>
  );
}