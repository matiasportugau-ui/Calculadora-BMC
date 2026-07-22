/**
 * Panelin Co-Work desk shell — minimal chrome at /panelin/cowork.
 * SDD-PANELIN-COWORK §10.4 Mode D + PR-H Document-PiP “Fijar arriba”.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useBmcAuthContext } from "../contexts/bmcAuthContext.js";
import { useChat } from "../hooks/useChat.js";
import {
  COWORK_MSG,
  onPanelinCoworkMessage,
  postPanelinCoworkMessage,
} from "../utils/panelinCoworkChannel.js";
import { persistDeskSize, readStoredDeskSize } from "../utils/openPanelinCoworkDesk.js";
import { isDocumentPipSupported, openDocumentPipWindow } from "../utils/openDocumentPip.js";
import PanelinChatPanel from "./PanelinChatPanel.jsx";

const EMPTY_CALC = {};

const headerBtn = {
  border: "1px solid rgba(255,255,255,0.35)",
  background: "transparent",
  color: "#fff",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

export default function PanelinCoWorkPage() {
  const bmcAuth = useBmcAuthContext();
  const [calcState, setCalcState] = useState(EMPTY_CALC);
  const [parentOnline, setParentOnline] = useState(false);
  const [pipWindow, setPipWindow] = useState(null);
  const pipSupported = isDocumentPipSupported();

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Panelin · Co-Work";
    }
    postPanelinCoworkMessage({ type: COWORK_MSG.HELLO, payload: { role: "desk" } });
  }, []);

  // Remember popup size on resize (best-effort).
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let t;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        persistDeskSize({ width: window.outerWidth, height: window.outerHeight });
      }, 400);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    return onPanelinCoworkMessage((msg) => {
      if (msg.type === COWORK_MSG.CALC_STATE) {
        setCalcState(msg.payload && typeof msg.payload === "object" ? msg.payload : EMPTY_CALC);
        setParentOnline(true);
      }
      if (msg.type === COWORK_MSG.FOCUS) {
        try {
          window.focus();
        } catch {
          /* ignore */
        }
      }
      if (msg.type === COWORK_MSG.CLOSE) {
        try {
          window.close();
        } catch {
          /* ignore */
        }
      }
    });
  }, []);

  const handleChatAction = useCallback((action) => {
    if (!action?.type) return;
    postPanelinCoworkMessage({ type: COWORK_MSG.CHAT_ACTION, payload: action });
  }, []);

  const authHeader = useMemo(
    () => (bmcAuth?.accessToken ? `Bearer ${bmcAuth.accessToken}` : undefined),
    [bmcAuth?.accessToken],
  );

  const chat = useChat({
    calcState,
    onAction: handleChatAction,
    operatorAccessToken: bmcAuth?.accessToken || "",
    persistHistory: true,
  });

  const focusParent = useCallback(() => {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.focus();
        return;
      }
    } catch {
      /* ignore */
    }
    window.location.href = "/";
  }, []);

  const onClose = useCallback(() => {
    if (pipWindow) {
      try {
        pipWindow.close();
      } catch {
        /* ignore */
      }
      setPipWindow(null);
      return;
    }
    try {
      window.close();
    } catch {
      /* ignore */
    }
    setTimeout(() => {
      if (!window.closed) window.location.href = "/";
    }, 150);
  }, [pipWindow]);

  /** PR-H: portal desk UI into Document PiP when available (Chrome). */
  const handlePinTop = useCallback(async () => {
    if (pipWindow) return;
    const size = readStoredDeskSize();
    const pip = await openDocumentPipWindow({
      width: size.width,
      height: size.height,
      mirrorStyles: true,
    });
    if (pip?.window) {
      pip.window.addEventListener("pagehide", () => setPipWindow(null), { once: true });
      setPipWindow(pip.window);
    }
  }, [pipWindow]);

  const shell = (
    <div
      style={{
        minHeight: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#0f172a",
        color: "#e2e8f0",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          background: "linear-gradient(90deg, #0f2744 0%, #1a3a5c 100%)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <strong style={{ fontSize: 14, letterSpacing: 0.2 }}>Panelin · Co-Work</strong>
          <span style={{ fontSize: 11, opacity: 0.75 }}>
            {pipWindow
              ? "Fijado arriba (Document PiP)"
              : parentOnline
                ? "Calculadora conectada (calcState en vivo)"
                : "Esperando calculadora — abrí desde «Abrir en ventana» o trabajá solo con planillas"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {pipSupported && !pipWindow && (
            <button
              type="button"
              onClick={handlePinTop}
              style={headerBtn}
              title="Fijar arriba (Picture-in-Picture sobre el navegador)"
              aria-label="Fijar arriba"
            >
              Fijar arriba
            </button>
          )}
          <button type="button" onClick={focusParent} style={headerBtn}>
            Volver a calculadora
          </button>
          <Link
            to="/"
            style={{
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#cbd5e1",
              borderRadius: 999,
              padding: "6px 12px",
              fontSize: 12,
              textDecoration: "none",
            }}
          >
            SPA
          </Link>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <PanelinChatPanel
          isOpen
          embeddedMode
          detachedMode
          onClose={onClose}
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          send={chat.send}
          clearSuggestionsForMessage={chat.clearSuggestionsForMessage}
          stop={chat.stop}
          retry={chat.retry}
          clear={chat.clear}
          error={chat.error}
          calcState={calcState}
          onChatAction={handleChatAction}
          authHeader={authHeader}
          onLoadConversations={chat.loadConversationList}
          onLoadConversationAnalysis={chat.loadConversationAnalysis}
        />
      </div>
    </div>
  );

  // Host page keeps full viewport when not in PiP; PiP gets the portal.
  if (pipWindow?.document?.body) {
    return (
      <>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f172a",
            color: "#94a3b8",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: 13,
            padding: 24,
            textAlign: "center",
          }}
        >
          Panelin Co-Work está fijado arriba. Cerrá la ventana PiP para volver acá.
        </div>
        {createPortal(shell, pipWindow.document.body)}
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", height: "100vh" }}>
      {shell}
    </div>
  );
}
