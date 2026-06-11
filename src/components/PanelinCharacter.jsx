import React, { useState, useEffect } from 'react';
import { PANELIN_AGENT_VIDEO_SRC } from '../utils/panelinAgentVideoSrc.js';

// One-time professional idle breathing + talking keyframes (novel but restrained)
if (typeof document !== "undefined" && !document.getElementById("panelin-character-animations")) {
  const s = document.createElement("style");
  s.id = "panelin-character-animations";
  s.textContent = `
    @keyframes panelin-idle-breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.012); }
    }
    @keyframes panelin-talking-ring {
      0%, 100% { transform: scale(1); opacity: 0.55; }
      50% { transform: scale(1.09); opacity: 0.22; }
    }
  `;
  document.head.appendChild(s);
}

/**
 * Reusable standing Panelin character.
 * Uses the exact same looping video animation as the current header circle (per spec).
 * Shows occasional friendly greetings (bubble) when rendered externally.
 *
 * When chat is closed: render this as the visible "standing" trigger.
 * When chat is open: the same animation appears inside the chatbox (via Avatar or direct usage).
 */
export default function PanelinCharacter({
  size = 52,
  onClick,
  className = '',
  style = {},
  greetIntervalMs = 78000, // ~every 1m18s on average
  initialGreetDelayMs = 8500,
  isSpeaking = false, // When TTS is active → professional talking animation
  isThinking = false, // When agent is streaming/processing → subtle thinking reaction
}) {
  const [showGreet, setShowGreet] = useState(false);

  function triggerGreet() {
    setShowGreet(true);
    // Auto hide after a few seconds
    setTimeout(() => setShowGreet(false), 4200);
  }

  // Occasional greet (bubble + subtle video emphasis)
  useEffect(() => {
    let initialTimer;
    let interval;

    // First greet shortly after mount (feels alive)
    initialTimer = setTimeout(() => {
      triggerGreet();
    }, initialGreetDelayMs);

    // Periodic greetings
    interval = setInterval(() => {
      triggerGreet();
    }, greetIntervalMs + Math.random() * 25000); // slight randomness so it doesn't feel robotic

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [greetIntervalMs, initialGreetDelayMs]);

  const videoStyle = {
    width: size,
    height: size,
    borderRadius: 14,
    objectFit: 'cover',
    flexShrink: 0,
    background: '#1a3a5c',
    border: isSpeaking
      ? '1.5px solid rgba(0, 113, 227, 0.55)'
      : isThinking
      ? '1.5px solid rgba(245, 158, 11, 0.6)'
      : showGreet
      ? '1.5px solid rgba(16, 185, 129, 0.6)'
      : '1.5px solid rgba(255,255,255,0.28)',
    boxShadow: isSpeaking
      ? '0 0 0 4px rgba(0, 113, 227, 0.28), 0 0 18px rgba(0, 113, 227, 0.22)'
      : isThinking
      ? '0 0 0 3px rgba(245, 158, 11, 0.35), 0 4px 12px rgba(0,0,0,0.15)'
      : showGreet
      ? '0 0 0 3px rgba(16, 185, 129, 0.35), 0 6px 16px rgba(0,0,0,0.18)'
      : '0 3px 10px rgba(0,0,0,0.18)',
    transform: isSpeaking || isThinking ? 'scale(1.03)' : showGreet ? 'scale(1.02)' : 'scale(1)',
    transition: 'transform 160ms cubic-bezier(0.23, 1.0, 0.32, 1), box-shadow 160ms ease, border-color 160ms ease',
    filter: isSpeaking ? 'saturate(1.08) contrast(1.03)' : isThinking ? 'saturate(0.9) brightness(0.95)' : 'none',
  };

  return (
    <div
      className={`panelin-character ${className}`}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        ...style,
      }}
      title="Panelin — hacé clic para chatear"
      aria-label="Personaje Panelin. Clic para abrir chat."
    >
      {/* The character itself — same animation asset as the header circle.
          Professional + novel: subtle idle breathing + strong reaction on greet/speaking */}
      <div
        style={{
          position: 'relative',
          animation: !isSpeaking && !showGreet ? 'panelin-idle-breathe 3.8s infinite ease-in-out' : 'none',
        }}
      >
        <video
          src={PANELIN_AGENT_VIDEO_SRC}
          autoPlay
          muted
          loop
          playsInline
          style={videoStyle}
        />

        {/* Professional speaking indicator ring (syncs with TTS) */}
        {isSpeaking && (
          <div
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: 18,
              border: '1.5px solid rgba(0, 113, 227, 0.4)',
              animation: 'panelin-talking-ring 1.05s infinite ease-in-out',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Subtle "standing" label for personality (premium, not childish) */}
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: '#1a3a5c',
          opacity: 0.6,
          marginTop: 2,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        Panelin
      </div>

      {/* Occasional greeting bubble (only when triggered) — clean and professional */}
      {showGreet && (
        <div
          style={{
            position: 'absolute',
            bottom: size + 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#fff',
            color: '#1a3a5c',
            fontSize: 11,
            fontWeight: 600,
            padding: '5px 12px',
            borderRadius: 999,
            boxShadow: '0 4px 14px rgba(0,0,0,0.13)',
            whiteSpace: 'nowrap',
            zIndex: 10,
            pointerEvents: 'none',
            border: '1px solid #e5e5ea',
          }}
        >
          ¡Hola! ¿Cómo va la cotización?
        </div>
      )}
    </div>
  );
}
