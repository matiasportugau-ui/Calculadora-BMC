import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useBmcAuthContext } from "../contexts/bmcAuthContext.js";
import { getCalcApiBase } from "../utils/calcApiBase.js";

const PANEL_TITLE = "Respondamos Rapido";
const STORAGE_KEY = "bmc_respondamos_rapido_open";
const DEFAULT_LOCAL_CHAT = "http://localhost:3000";
const DEFAULT_CLOUD_CHAT = "https://bmc-chat-642127786762.us-central1.run.app";

function resolveChatBase() {
  const override = import.meta.env?.VITE_BMC_CHAT_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  const useLocal =
    import.meta.env?.VITE_BMC_CHAT_LOCAL === "1"
    || String(import.meta.env?.VITE_BMC_CHAT_LOCAL || "").toLowerCase() === "true";
  if (useLocal) {
    const api = getCalcApiBase().replace(/\/+$/, "");
    return api ? `${api}/chat` : "/chat";
  }
  if (import.meta.env?.DEV) return DEFAULT_LOCAL_CHAT;
  return DEFAULT_CLOUD_CHAT;
}

function chatIframeOrigin(chatBase) {
  if (chatBase.startsWith("http")) return new URL(chatBase).origin;
  return window.location.origin;
}

function readStoredOpen() {
  try {
    if (localStorage.getItem(STORAGE_KEY) === "true") return true;
    if (localStorage.getItem("bmc_chat_panel_open") === "true") return true;
    if (localStorage.getItem("bmc_chat_panel_mode") === "expanded") return true;
  } catch { /* ignore */ }
  return false;
}

export default function BmcChatPanel() {
  const { accessToken } = useBmcAuthContext();
  const chatBase = useMemo(() => resolveChatBase(), []);

  const [open, setOpen] = useState(readStoredOpen);
  const [serverUp, setServerUp] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? "true" : "false");
      localStorage.setItem("bmc_chat_panel_open", open ? "true" : "false");
    } catch { /* ignore */ }
  }, [open]);

  const postAuthToIframe = useCallback(() => {
    if (!accessToken || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: "bmc-chat-auth", token: accessToken },
      chatIframeOrigin(chatBase),
    );
  }, [accessToken, chatBase]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
        const r = await fetch(`${chatBase}/api/inquiries`, {
          headers,
          signal: AbortSignal.timeout(3000),
        });
        if (!cancelled) setServerUp(r.ok);
      } catch {
        if (!cancelled) setServerUp(false);
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [accessToken, chatBase]);

  useEffect(() => {
    if (open && serverUp === true) postAuthToIframe();
  }, [open, serverUp, postAuthToIframe]);

  const statusDot = serverUp === true ? "#188038" : serverUp === false ? "#d93025" : "#f9ab00";

  return (
    <>
      <style>{`
        @keyframes bmcChatSpin { to { transform: rotate(360deg); } }
        @keyframes bmcRespondamosIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          right: 0,
          bottom: 0,
          zIndex: 9998,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          pointerEvents: "none",
        }}
      >
        {open && (
          <div
            id="bmc-respondamos-rapido-panel"
            role="dialog"
            aria-label={PANEL_TITLE}
            style={{
              pointerEvents: "auto",
              width: "min(400px, calc(100vw - 16px))",
              height: "min(560px, calc(100vh - 56px))",
              marginRight: 8,
              marginBottom: 4,
              background: "#fff",
              borderRadius: "12px 12px 4px 12px",
              border: "1px solid #dadce0",
              boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              animation: "bmcRespondamosIn 160ms ease-out",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderBottom: "1px solid #e8eaed",
                background: "#f8f9fa",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: statusDot,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#202124", flex: 1 }}>
                {PANEL_TITLE}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={`Cerrar ${PANEL_TITLE}`}
                title="Cerrar"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#5f6368",
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: "2px 6px",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
              {serverUp === null && (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#80868b", fontSize: 13 }}>
                  <div style={{ width: 16, height: 16, border: "2px solid rgba(26,115,232,0.2)", borderTopColor: "#1a73e8", borderRadius: "50%", animation: "bmcChatSpin 0.6s linear infinite", marginRight: 8 }} />
                  Conectando…
                </div>
              )}
              {serverUp === false && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 20, textAlign: "center", color: "#5f6368", fontSize: 13 }}>
                  <div>No se pudo conectar. Probá abrir en pestaña.</div>
                  <button
                    type="button"
                    onClick={() => window.open(chatBase, "_blank", "noopener")}
                    style={{
                      border: "1px solid #dadce0",
                      background: "#fff",
                      color: "#1a73e8",
                      borderRadius: 8,
                      padding: "8px 14px",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Abrir en pestaña
                  </button>
                </div>
              )}
              {serverUp === true && (
                <div style={{ flex: "1 1 auto", minHeight: 0, position: "relative" }}>
                  <iframe
                    ref={iframeRef}
                    src={chatBase}
                    onLoad={postAuthToIframe}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                    title={PANEL_TITLE}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="bmc-respondamos-rapido-panel"
          title={open ? `Cerrar ${PANEL_TITLE}` : `Abrir ${PANEL_TITLE}`}
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            height: 40,
            padding: "0 16px",
            marginRight: 0,
            border: "1px solid #dadce0",
            borderBottom: "none",
            borderRadius: "10px 10px 0 0",
            background: open ? "#e8f0fe" : "#fff",
            color: "#202124",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            cursor: "pointer",
            boxShadow: open ? "0 -2px 12px rgba(26,115,232,0.12)" : "0 -2px 8px rgba(0,0,0,0.08)",
            borderTop: "3px solid #1a73e8",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: statusDot,
              flexShrink: 0,
            }}
          />
          {PANEL_TITLE}
        </button>
      </div>
    </>
  );
}
