import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useBmcAuthContext } from "../contexts/bmcAuthContext.js";

const STORAGE_KEY = "bmc_chat_panel_open";

export default function BmcChatPanel() {
  const { accessToken, isAuthenticated } = useBmcAuthContext();
  const chatBase = useMemo(
    () => "https://bmc-chat-642127786762.us-central1.run.app",
    [],
  );

  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });
  const [serverUp, setServerUp] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, open ? "true" : "false");
  }, [open]);

  const postAuthToIframe = useCallback(() => {
    if (!accessToken || !iframeRef.current?.contentWindow) return;
    const origin = new URL(chatBase, window.location.origin).origin;
    iframeRef.current.contentWindow.postMessage(
      { type: "bmc-chat-auth", token: accessToken },
      origin,
    );
  }, [accessToken, chatBase]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setServerUp(false);
      return undefined;
    }

    let cancelled = false;
    const check = async () => {
      try {
        const r = await fetch(`${chatBase}/api/inquiries`, {
          headers: { Authorization: `Bearer ${accessToken}` },
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
  }, [accessToken, chatBase, isAuthenticated]);

  useEffect(() => {
    if (open && serverUp === true) postAuthToIframe();
  }, [open, serverUp, postAuthToIframe]);

  if (!isAuthenticated || serverUp === false) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        title={open ? "Cerrar chat BMC" : "Abrir chat BMC"}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 9999,
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "none",
          background: open ? "#d93025" : "#1a73e8",
          color: "#fff",
          fontSize: 20,
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.2s",
        }}
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 76,
            right: 20,
            zIndex: 9998,
            width: 400,
            height: "60vh",
            maxHeight: 700,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {serverUp === null && (
            <>
              <style>{`@keyframes bmcChatSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#80868b", fontSize: 13 }}>
                <div style={{ width: 16, height: 16, border: "2px solid rgba(26,115,232,0.2)", borderTopColor: "#1a73e8", borderRadius: "50%", animation: "bmcChatSpin 0.6s linear infinite", marginRight: 8 }} />
                Conectando…
              </div>
            </>
          )}
          {serverUp === true && (
            <iframe
              ref={iframeRef}
              src={chatBase}
              onLoad={postAuthToIframe}
              style={{ flex: 1, border: "none", width: "100%" }}
              title="BMC Chat"
            />
          )}
        </div>
      )}
    </>
  );
}
